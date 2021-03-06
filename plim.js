#!/usr/bin/env node

// TODO - enable on the fly rjs optimization via connect middleware
// TODO - some kind of unit test runner (plim -t <runs all known unit tests>)
// TODO - a way to download and update external js deps (e.g. jquery)
// TODO - add some kind of documentation generator (JSDoc? LessDoC?)
// TODO - add a 'setup' routine where standard dirs & files (css, js, index.html) are created based on user input
// TODO - auto-refresh browser based on file save

'use strict';

var fs = require( 'fs' ),
    path = require( 'path' ),
    cli = require( 'commander' ),
    less = require( 'less' ),
    express = require( 'express' ),
    rjs = require( 'requirejs' ),
    file = require( './src/file' ),
    config = require( './src/config' ),
    options = config.get();

var log = function( msg, showName ){
    msg = msg || '';

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

var startServer = function( port, root, isProd, lessMain, lessSrc ){
    var server = express.createServer(),
        lessCfg = {
            compress: false,
            force: true //meh... still no worky probably need this to land: https://github.com/cloudhead/less.js/pull/503
        };

    root = path.resolve( root );

    // override native compiler to enable LESS configs
    express.compiler.compilers.less.compile = function ( str, fn ) {
        try {
            less.render( str, lessCfg, fn );
        } catch ( err ) {
            log( err );
            log( '::::::::: error during {LESS} compilation :-(' );
            process.exit();
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
                req.url = req.url.replace( '/js-built/', '/js/' );
                if ( file.exists( path.join( root, lessMain ) ) ) {
                    fs.utimesSync( path.join( root, lessMain ), new Date(), new Date() );
                }
                next();
            });
        }
        server.use( express.compiler({
                src: path.normalize( root ),
                enable: [ 'less' ]
            })
        );
        server.use( express['static']( path.normalize( root ), { maxAge: 0 } ) );
        server.use( express.errorHandler({
                dumpExceptions: true,
                showStack: true
            })
        );
    });

    log( '::::::::: server listening on port ' + port + ( isProd ? ' [prod mode]' : '' ) + ' (ctrl+c to exit)', true );
    if ( parseInt( port, 10 ) < 1024  ){
        log( '::::::::: warning: port ' + port + ' requires root' );
    }
    server.listen( port );
};

var optimizeJS = function( cfgFilePath ){
    var buildCfg;

    log( '::::::::: optimizing AMD JS files', true );

    try {
        buildCfg = eval( fs.readFileSync( cfgFilePath, 'utf8' ) ); // oh my!
        rjs.optimize( buildCfg, function( data ){
            log( data, false );
        });
    } catch( err ){
        log( err );
        log( '::::::::: error during JS optimization :-(' );
        process.exit();
    }
};

cli
    .version( '0.0.5' )
    .option( '-s, --setup', 'Setup you plim.config file' )
    .option( '-p, --port <port>', 'Set server port (default is 3000)' )
    .option( '-P, --production', 'Run in production mode (uses optimized resource files)' )
    .option( '-o, --optimizeJS [build file]', 'Run rjs AMD js optimization (default build file is "js/build.js")' )
    .option( '-l, --less [value]', 'Set "main" less file to target when forcing less recompilation' )
    .on( '--help', function(){ log('', true); })
    .parse( process.argv );

options.isProduction = cli.production ? true : options.isProduction;
options.lessMain = typeof cli.less === 'string' ? cli.less : options.lessMain;
options.optimizeJS = cli.optimizeJS ? true : options.optimizeJS;
options.jsBuildCfg = typeof cli.optimizeJS === 'string' ? cli.optimizeJS : options.jsBuildCfg;
options.port = cli.port ? cli.port : options.port;

if ( options.optimizeJS ){
    optimizeJS( path.join( options.basePath, options.jsBuildCfg ) );
    process.exit();
}

if ( cli.setup ) {
    log( '::::::::: Setup Your Plim Configs (ctrl+c to exit)', true );
    cli.prompt({
        port: ':: Port to serve from?: ',
        isProduction: ':: Run in production mode?: ',
        optimizeJS: ':: Optimize javascript on startup?: ',
        basePath: ':: "basePath" - Top level directory for you project?: ',
        jsBuildCfg: ':: Relative to "basePath", where is your js build config file?: ',
        lessSrc: ':: Relative to "basePath", what directory contians your {LESS} source files?: ',
        lessOut: ':: Relative to "basePath", where should css output by {LESS} compilation be stored?: ',
        lessMain: ':: Relative to "basePath", where is your main.less file?: '
    }, function( cfg ){
        log( '::::::::: Saving Configs' );
        config.writeFile( config.validateInput( cfg ) );
    });
} else {
    log( '::::::::: options' );
    log( ':: isProduction : ' + ( options.isProduction ? 'true' : 'false' ) );
    log( ':: port : ' + options.port );
    log( ':: basePath : ' + path.join( options.basePath ) );
    log( ':: lessSrc : ' + path.join( options.basePath, options.lessSrc ) );
    log( ':: lessMain : ' + path.join( options.basePath, options.lessMain ) );
    log( ':: jsBuildCfg : ' + path.join( options.basePath, options.jsBuildCfg ) );

    startServer(
        options.port,
        options.basePath,
        options.isProduction,
        options.lessMain,
        options.lessSrc
    );
}
