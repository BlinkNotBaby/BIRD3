// Core
var fs = require("fs"),
    url = require("url"),
    path = require("path"),
    crypto = require("crypto"),
    mime = require("mime")
    mkdirp = require("mkdirp")
    md5_file = require("md5-file");

// Connect
var st = require("st"),
    ex_static = require("express-static"),
    oj = require("connect-oj"),
    php = require("./php_handler.js"),
    Imagemin = require("imagemin"),
    cssmin = require("cssmin"),
    bodyParser = require('body-parser'),
    multiparty = require("connect-multiparty"),
    responseTime = require("response-time"),
    compression = require("compression");

var debug = require("debug")("bird3:http");

// Options
var stOpts = {
    index: false,
    dot: false,
    gzip: true,
    cache: { // specify cache:false to turn off caching entirely
        fd: {
            max: 1000, // number of fd's to hang on to
            maxAge: 1000*60*60, // amount of ms before fd's expire
        },
        stat: {
          max: 5000, // number of stat objects to hang on to
          maxAge: 1000*60, // number of ms that stats are good for
        },
        content: {
          max: 1024*1024*64, // how much memory to use on caching contents
          maxAge: 1000*60*60, // how long to cache contents for
                              // if `false` does not set cache control headers
          //cacheControl: 'public, max-age=600' // to set an explicit cache-control
                                              // header value
        }
    }
};

module.exports = function(app) {
    // We need to incororate with NGINX or any other webserver here.
    debug("BIRD3 WebService: Starting...");

    // Some tiny middlewares...
    app.use(compression());
    app.use(responseTime());

    // Expires: header
    app.use(config.CDN.baseUrl, function(req,res,next){
        if(typeof req.query.nocache == "undefined") {
            var now = new Date().getTime();
            var age = stOpts.cache.content.maxAge;
            res.setHeader("Expires", new Date(now+age).toUTCString());
        }
        next();
    });

    // Inject API and CloudFlare
    require("./cloudflare_worker.js")(app);
    require("./api_handler.js")(app);

    // Initialize the cache server...
    var __url = 'http://'+config.CDN.url+config.CDN.baseUrl;
    // CDN must not return caching when not needed.
    app.use(config.CDN.baseUrl, function(req, res, next){
        if("nocache" in req.query) {
            return ex_static(config.base+"/cdn")(req, res, next);
        } else return next();
    });
    // OJ is sort-of dynamic, so it needs to be first.
    var files={};
    app.use("/cdn/oj", function(req, res, next){
        var file = config.base+"/cdn/oj"+req.url;
        if(fs.existsSync(file)) {
            var out;
            var age = 30*24*60*60;
            var time = Date.now();
            var d = new Date(Date.now() + age*1000);
            if(
                typeof files[file] != "undefined" && (
                    files[file].time < time
                    || md5_file(file) == files[file].md5)
            ) {
                out = files[file].out;
                files[file].time = time;
            } else {
                out = md5_file(file);
                files[file] = {};
                files[file].out = out;
                files[file].time = time;
                files[file] = out;
            }
            if(
                "if-none-match" in req.headers
                && req.headers["if-none-match"] == out
            ) {
                res.writeHead(304);
                return res.end();
            } else {
                res.setHeader("Etag", out);
                res.setHeader("Cache-control", "public, max-age="+age);
                res.setHeader("Expires", d.toUTCString());
                return next();
            }
        } else return next();
    });
    app.use("/cdn/oj", oj({
        dir: config.base+"/cdn/oj"
    }));

    // For any generic file, this will work.
    app.use(config.CDN.baseUrl, function(req, res, next){
        var fname = path.basename(req.url);
        var ext = path.extname(fname);
        if(ext.substr(1).match(/^(png|jpg|jpeg|gif|svg)$/i)) {
            var infile = config.base+"/cdn/"+url.parse(req.url).pathname;
            if(!fs.existsSync(infile)) return next();
            if(
                typeof req.headers["if-none-match"] != "undefined"
                && req.headers["if-none-match"]==md5_file(infile)
            ) {
                //debug("Its cached.");
                res.statusCode = 304;
                return res.end();
            }
            var dirname = path.dirname(req.url);
            mkdirp(config.base+"/cache/cdn/"+dirname, function(err){
                if(err) {
                    console.log("Error",err);
                    return next();
                }
                var cacheDir = config.base+"/cache/";
                var outdir = config.base+"/cache/cdn/"+path.dirname(req.url);
                var outname = md5_file(infile)+"-"+path.basename(infile);
                var outfile = path.join(outdir, outname);
                var extName = ext.substr(1);
                fs.exists(outfile, function(exists){
                    // One way or another, we're sending something here, so set headers.
                    var age = 30*24*60*60;
                    var time = Date.now();
                    var d = new Date(Date.now() + age*1000);
                    res.setHeader("Etag", md5_file(infile)); // Outfile wont exist, but we can cheat. :)
                    res.setHeader("Cache-control", "public, max-age="+age);
                    res.setHeader("Expires", d.toUTCString());
                    if(!exists) {
                        //debug("BIRD3 CDN -> Generating: ",outfile);
                        var imagemin = new Imagemin()
                            .src(infile)
                            .use(Imagemin.jpegtran({ progressive: true }))
                            .use(Imagemin.gifsicle())
                            .use(Imagemin.optipng())
                            .use(Imagemin.pngquant())
                            .use(Imagemin.svgo());
                        imagemin.run(function(err, files, stream){
                            if(err) {
                                BIRD3.error("Imagemin error");
                                BIRD3.error(err);
                                return next();
                            }
                            fs.writeFile(outfile, files[0].contents, function(err){
                                if(err) {
                                    //BIRD3.error("Can not write optimized image: "+outfile);
                                    console.error(err);
                                }
                                res.setHeader("Content-type", mime.types[extName]);
                                res.end(files[0].contents);
                                return;
                            });
                        });
                    } else {
                        //debug("BIRD3 CDN -> Sending generated: "+outfile);
                        fs.readFile(outfile, function(err, output){
                            if(err) {
                                //BIRD3.error(err);
                                return next();
                            }
                            res.setHeader("Content-type", mime.types[extName]);
                            res.end(output);
                            return;
                        });
                    }
                });
            });
        } else return next();
    });
    var cdn_st = stOpts;
    cdn_st.path = config.base+"/cdn";
    app.use(config.CDN.baseUrl, st(cdn_st));

    // Configuring the BIRD Main server.
    app.use("/", bodyParser.urlencoded({
      extended: true
    }));
    app.use("/", multiparty(config.version));
    app.use("/", function(_req, _res, next){
        BIRD3.emit("web_request", {req:_req, res:_res});
        return next();
    });
    app.use("/", php());

    debug("BIRD3 WebService: Running.");
}