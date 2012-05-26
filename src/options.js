'use strict';

Object.defineProperty(Object.prototype, 'extend', {
    enumerable: false,
    value: function( from ) {
        var props = Object.getOwnPropertyNames( from ),
            dest = this;

        props.forEach(function( name ) {
            if ( name in dest ) {
                var destination = Object.getOwnPropertyDescriptor( from, name );
                Object.defineProperty( dest, name, destination );
            }
        });

        return this;
    }
});

var path = require( 'path' ),
    file = require( './file' ),
    defaults = {
        port: 3000,
        basePath: process.cwd(),
        isProduction: false,
        optimizeJS: false,
        jsBuildCfg: 'js/build.js',
        lessSrc: 'css/',
        lessOut: 'css/',
        lessMain: 'css/main.less'
    };

var getConfigs = function() {
    var name = "plim.config",
        projConfig = file.find( name ),
        globalConfig = path.normalize( path.join( process.env.HOME, name ) );

    if ( projConfig ) {
        return defaults.extend( file.loadAsJSON( projConfig ) );
    }

    return defaults;
};


module.exports = {
    getConfigs: getConfigs
};
