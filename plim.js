#!/usr/bin/env node

// TODO - enable on the fly rjs optimization via connect middleware
// TODO - some kind of unit test runner (plim -t <runs all known unit tests>)
// TODO - add some kind of documentation generator (JSDoc? LessDoC?)
// TODO - add a 'setup' routine where standard dirs & files (css, js, index.html) are created based on user input

(function(){
    "use strict";

    var fs = require( 'fs' ),
        path = require('path'),
        deps = [ 'commander', 'less', 'requirejs', 'express' ],
        cli = {},
        options = {
            port: 3000,
            baseUrl: process.cwd(),
            jsBuildCfg: 'js/build.js',
            lessSrc: 'css/',
            lessOut: 'css/',
            lessMain: 'css/main.less'
        },
        npm, rjs, express, less, server;

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
            .option( '-s, --setup', 'Setup and install dependencies' )
            .option( '-p, --port <port>', 'Set server port (default is 3000)', parseInt, 3000 )
            .option( '-P, --production', 'Run in production mode (uses optimized resource files)' )
            .option( '-o, --optimizeJS [build file]', 'Run rjs AMD js optimization (default build file is "js/build.js")' )
            .option( '-l, --less [value]', 'Set "main" less file to target when forcing less recompilation' );

        options = loadConfig( findConfig() );

        console.log( options );
        console.log( path.join( options.baseUrl, options.lessMain ) );
        console.log(  path.join( options.baseUrl, options.lessSrc ) );

        //process.exit();

        cli.on( '--help', function(){
            log();
        });

        cli.parse( process.argv );

        if ( typeof cli.less === 'string' ){
            options.lessMain = cli.less;
        }

        if ( cli.optimizeJS ){
            optimizeJS( typeof cli.optimizeJS === 'boolean' ? 'js/build.js' : cli.optimizeJS );
            process.exit();
        }

        if ( cli.setup ){
            install( deps );
        } else {
            start( cli.port );
        }
    };

    // config & start server
    var start = function( port ){
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
            if ( cli.production ){
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
                    fs.utimesSync( path.join( options.baseUrl, options.lessMain ), new Date(), new Date() );
                    next();
                });
            }
            server.use( express.compiler({
                    src: path.normalize( options.baseUrl ),
                    enable: [ 'less' ]
                })
            );
            server.use( express.static( path.normalize( options.baseUrl ), { maxAge: 0 } ) );
            server.use( express.errorHandler({
                    dumpExceptions: true,
                    showStack: true
                })
            );
        });

        log( '::::::::: server listenting on port ' + port + ( cli.production ? ' [prod mode]' : '' ) + ' (ctrl+c to exit)' );
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

    var install = function( deps ){
        var depsToInstall = [];

        npm = require( 'npm' );

        npm.once( 'loaded', function(){
            for ( var i = 0; i < deps.length; i = i + 1 ){
                try {
                    require.resolve( deps[ i ] );
                } catch ( e ){
                    depsToInstall.push( deps[ i ] );
                }
            }

            if ( depsToInstall.length ){
                npm.emit( 'install' );
            } else {
                log( '::::::::: all dependencies installed!' );
            }
        });

        npm.once( 'install', function(){
            log( '::::::::: installing deps: ' + depsToInstall.join( ', ' ) );
            npm.commands.install( depsToInstall, function ( err, data ) {
                if ( err ){
                    log( err, false );
                }
                // module installs succeeded, start cmd-line
                init();
            });
        });

        npm.load( {}, function( err ){
            if ( err ){
                log( err, false );
            }
            npm.emit( 'loaded' );
        });
    };


    // initialize app
    try {
        init();
    } catch( err ){
        install( deps );
    }
})();
