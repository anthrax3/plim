#!/usr/bin/env node

// TODO - enable on the fly rjs optimization via connect middleware
// TODO - some kind of unit test runner (plim -t <runs all known unit tests>)
// TODO - add some kind of documentation generator (JSDoc? LessDoC?)
// TODO - add a 'setup' routine where standard dirs & files (css, js, index.html) are created based on user input
// TODO - auto-refresh browser based on file save

(function(){
    "use strict";

    var fs = require( 'fs' ),
        path = require('path'),
        cli = {},
        options = {
            port: 3000,
            basePath: process.cwd(),
            isProduction: false,
            optimizeJS: false,
            jsBuildCfg: 'js/build.js',
            lessSrc: 'css/',
            lessOut: 'css/',
            lessMain: 'css/main.less'
        },
        rjs, express, less, server;

    // utils //////////////////////////////////////////////////////////////////
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

    var exists = function() {
        var obj = fs.existsSync ? fs : path;
        return obj.existsSync.apply( obj, arguments );
    };

    var findFile = function( name, dir ) {
        dir = dir || process.cwd();

        var filePath = path.normalize( path.join( dir, name ) );

        if ( exists( filePath ) ) {
            return filePath;
        }

        return dir === "/" ?
            null : findFile( name, path.normalize( path.join( dir, ".." ) ) );
    };

    var findConfig = function() {
        var name = "plim.config",
            projConfig = findFile( name ),
            globalConfig = path.normalize( path.join( process.env.HOME, name ) );

        if ( projConfig ) {
            return projConfig;
        }

        if ( exists( globalConfig ) ) {
            return globalConfig;
        }

        return false;
    };

    var loadConfig = function ( filePath ) {
        return filePath && exists( filePath ) ?
                JSON.parse( fs.readFileSync( filePath, "utf-8" ) ) : options;
    };

    var log = function( msg, showName ){
        msg = msg || '';
        showName = typeof showName === 'undefined' ? true : showName;

        if ( showName === true ){
            console.log(
                '    ___  __   _____       \n' +
                '   / _ \\/ /   \\_   \\/\\/\\  \n' +
                '  / /_)/ /     / /\\/    \\ \n' +
                ' / ___/ /___/\\/ /_/ /\\/\\ \\\n' +
                ' \\/   \\____/\\____/\\/    \\/\n'
            );
        }

        console.log( msg );
    };

    // enable command-line interface & setup configs
    var init = function(){
        cli = require( 'commander' );
        cli
            .version( '0.0.5' )
            .option( '-p, --port <port>', 'Set server port (default is 3000)', parseInt, 3000 )
            .option( '-P, --production', 'Run in production mode (uses optimized resource files)' )
            .option( '-o, --optimizeJS [build file]', 'Run rjs AMD js optimization (default build file is "js/build.js")' )
            .option( '-l, --less [value]', 'Set "main" less file to target when forcing less recompilation' );

        cli.on( '--help', function(){
            log();
        });

        cli.parse( process.argv );

        options.extend( loadConfig( findConfig() ) );

        options.isProduction = cli.production ? true : options.isProduction;
        options.lessMain = typeof cli.less === 'string' ? cli.less : options.lessMain;
        options.optimizeJS = cli.optimizeJS ? true : options.optimizeJS;
        options.jsBuildCfg = typeof cli.optimizeJS === 'string' ? cli.optimizeJS : options.jsBuildCfg;
        options.port = cli.port ? cli.port : options.port;

        console.log( 'options.basePath : ' + path.join( options.basePath ) );
        console.log( 'options.lessSrc : ' + path.join( options.basePath, options.lessSrc ) );
        console.log( 'options.lessMain : ' + path.join( options.basePath, options.lessMain ) );
        console.log( 'options.jsBuildCfg : ' + path.join( options.basePath, options.jsBuildCfg ) );

        if ( options.optimizeJS ){
            optimizeJS( path.join( options.basePath, options.jsBuildCfg ) );
            process.exit();
        }

        start(
            options.port,
            options.basePath,
            options.isProduction,
            options.lessMain,
            options.lessSrc
        );
    };

    // config & start server
    var start = function( port, root, isProd, lessMain, lessSrc ){
        var lessCfg = {
            compress: false,
            force: true //meh... still no worky probably need this to land: https://github.com/cloudhead/less.js/pull/503
        };

        less = require( 'less' );
        express = require( 'express' );
        server = express.createServer();

        // override native compiler to enable LESS configs
        express.compiler.compilers.less.compile = function ( str, fn ) {
            try {
                less.render( str, lessCfg, fn );
            } catch ( err ) {
                fn( err );
            }
        };

        server.configure(function(){
            if ( isProd ){
                lessCfg.compress = true;
                //app.use( express.compress() ); // not until connect 2.0 :-(
                server.use(function( req, res, next ){
                    if ( req.url.indexOf( '/js/' ) > -1 ){
                        req.url = req.url.replace( '/js/', '/js-built/' );
                    }
                    next();
                });
            } else {
                server.use( function( req, res, next ){
                    fs.utimesSync( path.join( root, lessMain ), new Date(), new Date() );
                    next();
                });
            }
            server.use( express.compiler({
                    src: path.normalize( root ),
                    enable: [ 'less' ]
                })
            );
            server.use( express.static( path.normalize( root ), { maxAge: 0 } ) );
            server.use( express.errorHandler({
                    dumpExceptions: true,
                    showStack: true
                })
            );
        });

        log( '::::::::: server listenting on port ' + port + ( isProd ? ' [prod mode]' : '' ) + ' (ctrl+c to exit)' );
        server.listen( port );
    };

    var optimizeJS = function( cfgFilePath ){
        log( '::::::::: optimizing AMD JS files' );

        var buildCfg =  eval( fs.readFileSync( cfgFilePath, 'utf8' ) ); // oh my!

        rjs = require( 'requirejs' );

        try {
            rjs.optimize( buildCfg, function( data ){
                log( data, false );
            });
        } catch( err ){
            log( err );
        }
    };

    // initialize app
    try {
        init();
    } catch( err ){
        log( err, false );
    }
}());
