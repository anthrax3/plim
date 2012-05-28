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

var fs = require( 'fs' ),
    path = require( 'path' ),
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

var get = function() {
    var name = "plim.config",
        projConfig = file.find( name ),
        globalConfig = path.normalize( path.join( process.env.HOME, name ) );

    if ( projConfig ) {
        return defaults.extend( file.loadAsJSON( projConfig ) );
    }

    return defaults;
};

var validateInput = function( cfg ){
    var targetType;
    for ( var prop in cfg ){
        if ( cfg.hasOwnProperty( prop ) ){
            targetType = typeof defaults[ prop ];
            if ( ! cfg[ prop ] || ( targetType === 'number' && isNaN( cfg[ prop ] ) ) ) {
                delete cfg[ prop ];
                continue;
            }
            if ( targetType === 'number') {
                cfg[ prop ] = parseInt( cfg[ prop ], 10 );
            }
            if ( targetType === 'boolean' ){
                cfg[ prop ] = cfg[ prop ].toLowerCase();
                cfg[ prop ] = cfg[ prop ] === 'true' ?
                    true : cfg[ prop ] === 'yes' ?
                    true : cfg[ prop ] === 'y' ?
                    true : cfg[ prop ] === '1' ?
                    true : false;
            }
        }
    }

    return cfg;
};

var writeFile = function( cfg ){
    var pathToConfig;
    cfg = JSON.stringify( defaults.extend( cfg ) );
    pathToConfig = path.normalize( path.join( process.cwd(), 'plim.config' ) );
    fs.writeFile( pathToConfig, cfg, function ( err ) {
        if ( err ) { throw err; }
        console.log( '::::::::: Save Complete' );
        process.exit();
    });
};

module.exports = {
    get: get,
    validateInput: validateInput,
    writeFile: writeFile
};
