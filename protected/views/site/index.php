<?php
/* @var $this SiteController */

$this->pageTitle="Home";

#$this->tabbar="WHADAFU1";
#$this->leftSide="some app links";
?>

<h3>Don't mind the below, its dev stuff.</h3>
<pre><?php
    echo joinPaths([Yii::getPathOfAlias("ext"), "file.md"]);
?></pre>
