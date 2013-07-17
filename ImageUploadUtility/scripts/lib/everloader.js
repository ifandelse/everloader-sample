/*
 everloader
 Author: Jim Cowart (http://freshbrewedcode.com/jimcowart)
 License: Dual licensed MIT (http://www.opensource.org/licenses/mit-license) & GPL (http://www.opensource.org/licenses/gpl-license)
 Version 0.1.0
 */
(function ( root, factory ) {
	if ( typeof module === "object" && module.exports ) {
		// Node, or CommonJS-Like environments
		module.exports = (function () {
			var $ = require( 'jquery' );
			return factory( $, root );
		}());
	} else if ( typeof define === "function" && define.amd ) {
		// AMD. Register as an anonymous module.
		define( ["jquery"], function ( $ ) {
			return factory( $, root );
		} );
	} else {
		// Browser globals
		root.everloader = factory( root.$, root );
	}
}( this, function ( $, global, undefined ) {

	// The _config object contains all the state/behavior that
	// can be customized as needed by the consuming developer
	var _config = {

		// Everlive API Key
		apiKey : "",

		/* Allowed mime types for upload.
		   If it's empty, anything is allowed.
		   For example, to allow only jpeg, png
		   and gifs:
				mimeTypes : [
					"image/jpeg",
					"image/jpeg",
					"image/png",
					"image/gif"
				],
		*/
		mimeTypes : [],

		// Collective time limit on the uploads
		timeout : 60000,

		// helper function to produce the base64
		// for a given file input item
		getBase64ImageFromInput : function ( input, cb ) {
			var reader = new FileReader();
			reader.onloadend = function ( e ) {
				if ( cb ) {
					cb( e.target.result );
				}
			};
			reader.readAsDataURL( input );
		},

		// Returns Everlive API Uri
		getElUri : function () {
			return "https://api.everlive.com/v1/" + this.apiKey + "/Files";
		},

		// Helper method returning an array/iterate-able list
		// of input[type=file] elements to be used for upload
		getFileInputs : function () {
			return document.querySelectorAll( 'input[type="file"]' );
		},

		// produces the appropriate object structure
		// necessary for Everlive to store our file
		getImageFileObject : function ( input, cb ) {
			var name = input.name;
			var ext = name.substr( name.lastIndexOf( '.' ) + 1 ).toLowerCase();
			if ( !_config.mimeTypes.length || _config.mimeTypes.indexOf(input.type) ) {
				this.getBase64ImageFromInput( input, function ( base64 ) {
					var res = {
						"Filename" : name,
						"ContentType" : input.type,
						"base64" : base64.substr( base64.lastIndexOf( 'base64,' ) + 7 )
					};
					cb( null, res );
				} );
			} else {
				cb( "File type not supported: " + ext );
			}
		}
	};

	// How we process individual files...
	var _processFile = function ( file, done ) {
		_config.getImageFileObject(
			file,
			function ( err, fileObj ) {
				if ( err ) {
					done( err );
					return;
				}
				$.ajax( {
					type : "POST",
					url : _config.getElUri(),
					contentType : "application/json",
					data : JSON.stringify( fileObj ),
					error : function ( error ) {
						done( error );
					}
				} ).done( function ( data ) {
						done( null, data.Result );
					} );
			}
		);
	};

	// How we process individual input[type=file] elements,
	// which can have 1-n files to upload
	var _processInputElem = function ( elem, result, done ) {
		var fileCnt = elem.files.length;
		var j = 0;
		var filesToProcess = fileCnt;
		var elemId = elem.getAttribute( "id" );
		var res = result[elemId] = (result[elemId] || {});
		var getHandler = function ( idx, fileName ) {
			return function ( err, data ) {
				if ( !err ) {
					data.originalIndex = idx;
					res[data.Id] = data;
				} else {
					result.errors._count++;
					result.errors[elemId] = result.errors[elemId] || [];
					result.errors[elemId].push( {
						filename : fileName,
						error : err,
						originalIndex : idx
					} );
				}
				filesToProcess--;
				if ( !filesToProcess ) {
					done();
				}
			};
		};
		for ( ; j < fileCnt; j++ ) {
			_processFile( elem.files[j], getHandler( j, elem.files[j].name ) );
		}
	};

	// The public API of the module.....
	return {
		configure : function ( cfg ) {
			if ( !cfg ) {
				return _config;
			}
			_.extend( _config, cfg );
		},

		upload : function ( done ) {
			var elems = _config.getFileInputs();
			var inCnt = elems.length;
			var toProcess = inCnt;
			var i = 0;
			var result = { errors : { _count : 0 } };
			var promise = $.Deferred(function ( dfd ) {
				var handler = function () {
					toProcess--;
					if ( !toProcess ) {
						if (result.errors._count === 0) {
							dfd.resolve( result );
						} else {
							dfd.reject( result );
						}
					}
				};
				setTimeout( function () {
					dfd.reject( {
						error : "The operation timed out.",
						result : result
					} );
				}, _config.timeout );
				for ( ; i < inCnt; i++ ) {
					_processInputElem( elems[i], result, handler );
				}
			} ).promise();
			if ( done ) {
				promise.then( done );
			}
			return promise;
		}
	};
} ));