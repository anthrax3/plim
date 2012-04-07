#!/usr/bin/env node

// TODO - enable on the fly rjs optimization via connect middleware
// TODO - some kind of unit test runner (plim -t <runs all known unit tests>)
// TODO - add some kind of documentation generator (JSDoc? LessDoC?)

(function(){
    "use strict";

    var fs = require( 'fs' ),
        deps = [ 'commander', 'less', 'requirejs', 'express' ],
        prog = {},
        options = {
            port: 3000,
            jsBuildCfg: 'js/build.js',
            lessSrc: 'css/',
            lessOut: 'css/',
            lessMain: 'css/main.less'
        },
        log, install, init, start, optimize, npm, rjs, express, less, app;

    log = function( msg, showName ){
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

    // command-line interface
    init = function(){
        prog = require( 'commander' );
        prog
            .version( '0.0.2' )
            .option( '-s, --setup', 'Setup and install dependencies' )
            .option( '-p, --port <port>', 'Set server port (default is 3000)', parseInt, 3000 )
            .option( '-P, --production', 'Run in production mode (uses optimized resource files)' )
            .option( '-o, --optimize [build file]', 'Run rjs AMD js optimization (default build file is "js/build.js")' )
            .option( '-l, --less [value]', 'Set "main" less file to target when forcing less recompilation' );

        prog.on( '--help', function(){
            log();
        });

        prog.parse( process.argv );

        if ( typeof prog.less === 'string' ){
            options.lessMain = prog.less;
        }

        if ( prog.optimize ){
            optimize( typeof prog.optimize === 'boolean' ? 'js/build.js' : prog.optimize );
            process.exit();
        }

        if ( prog.setup ){
            install( deps );
        } else {
            start( prog.port );
        }
    };

    // config & start server
    start = function( port ){
        var lessCfg = {
            compress: false,
            force: true //meh... still no worky probably need this to land: https://github.com/cloudhead/less.js/pull/503
        };

        less = require( 'less' );
        express = require( 'express' );
        app = express.createServer();

        // override native compiler to enable LESS configs
        express.compiler.compilers.less.compile = function ( str, fn ) {
            try {
                less.render( str, lessCfg, fn );
            } catch ( err ) {
                fn( err );
            }
        };

        app.configure(function(){
            if ( prog.production ){
                lessCfg.compress = true;
                //app.use( express.compress() ); // not until connect 2.0 :-(
                app.use(function( req, res, next ){
                    if ( req.url.indexOf( '/js/' ) > -1 ){
                        req.url = req.url.replace( '/js/', '/js-built/' );
                    }
                    next();
                });
            } else {
                app.use( function( req, res, next ){
                    fs.utimesSync( options.lessMain, new Date(), new Date() );
                    next();
                });
            }
            app.use( express.compiler({
                    src: __dirname + '/',
                    enable: [ 'less' ]
                })
            );
            app.use( express.static( __dirname + '/', { maxAge: 0 } ) );
            app.use( express.errorHandler({
                    dumpExceptions: true,
                    showStack: true
                })
            );
        });

        log( '::::::::: server listenting on port ' + port + ( prog.production ? ' [prod mode]' : '' ) + ' (ctrl+c to exit)' );
        app.listen( port );
    };

    optimize = function( cfgFilePath ){
        log( '::::::::: optimizing AMD JS files' );

        var config =  eval( fs.readFileSync( cfgFilePath, 'utf8' ) ); // oh my!

        rjs = require( 'requirejs' );

        try {
            rjs.optimize( config, function( data ){
                log( data, false );
            });
        } catch( err ){
            log( err );
        }
    };

    install = function( deps ){
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
