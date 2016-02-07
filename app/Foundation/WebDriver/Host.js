var spawn = require("child_process").spawn;
var fs = require("fs");
var which = require("which").sync;
var merge = require("merge");
var path = require("path");
var watchGlob = require("watch-glob");

module.exports = Host;
function Host(options) {
    if(!(this instanceof Host)) {
        return new Host(options);
    }

    options = merge({
        // The class to control the process
        procClass: false,
        // The composer autoloader file
        composerFile: false,
        // The arguments passed to the application constructor
        args: [],

        // OPTIONAL
        // CWD for PHP
        cwd: process.cwd(),

        // Should we watch?
        isWatching: false,

        // Pattern for watch
        watchPattern: null,

        // Where?
        watchPath: null
    }, options);

    // Sanity check
    if(options.procClass == false) {
        throw new Error("You need to supply the class path to a valid PHP class.");
    }
    if(options.composerFile == false) {
        throw new Error("You need to supply the path to the Composer autoloader.");
    }
    if(options.isWatching) {
        if(options.watchPattern == null) {
            throw new Error("isWatching is on, but no pattern specified.");
        }
        if(options.watchPath == null) {
            throw new Error("isWatching is on, but no base path specified.")
        }
    }

    // Try to find PHP...
    var phpBin;
    if(!which("php") && !which("php-cli")) {
        throw new Error("Neither PHP or PHP-CLI were found. Can not run WebDriver.");
    } else {
        if(which("php")) {
            phpBin = "php";
        } else if(which("php-cli")) {
            phpBin = "php-cli";
        }

        var args = [
            path.join(__dirname, "Service/WebDriverService.php"),
            "start"
        ];
        var opts = {
            cwd: options.cwd,
            env: merge(process.env, {
                BIRD3_WEBDRIVER_CONF: JSON.stringify({
                    composerFile: options.composerFile,
                    mainClass: options.procClass,
                    args: options.args
                })
            }),
            stdio: ["ignore", process.stdout, process.stderr]
        };
        var php = spawn(phpBin, args, opts);

        if(options.isWatching) {
            var cb = function(/*No args needed.*/) {
                php.kill("SIGUSR1");
            }
            php.watcher = watchGlob(options.watchPattern, {
                cwd: options.watchPath
            }, cb, cb);
        }

        return php;
    }
}
