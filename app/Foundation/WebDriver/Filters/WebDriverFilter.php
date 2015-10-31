<?php namespace BIRD3\Foundation\WebDriver\Filters;

use BIRD3\Foundation\WebDriver\Response as WebDriverResponse;
use BIRD3\Backend\Log;

class WebDriverFilter {

    public function filter($request, $response) {
        if(!($response instanceof WebDriverResponse)) {
            return new WebDriverResponse(
                $response->content(),
                $response->status(),
                $response->headers
            );
        }
    }

}