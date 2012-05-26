'use strict';

var fs = require( 'fs' ),
    path = require( 'path' );

var exists = function() {
    var obj = fs.existsSync ? fs : path;
    return obj.existsSync.apply( obj, arguments );
};

var find = function( name, dir ) {
    dir = dir || process.cwd();

    var filePath = path.normalize( path.join( dir, name ) );

    if ( exists( filePath ) ) {
        return filePath;
    }

    return dir === "/" ?
        null : find( name, path.normalize( path.join( dir, ".." ) ) );
};

var loadAsJSON = function ( filePath ) {
    return filePath && exists( filePath ) ?
            JSON.parse( fs.readFileSync( filePath, "utf-8" ) ) : null;
};

module.exports = {
    exists: exists,
    find: find,
    loadAsJSON: loadAsJSON
};
