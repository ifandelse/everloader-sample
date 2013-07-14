var app = (function () {
    'use strict';

    // global error handling
    var showAlert = function(message, title, callback) {
        navigator.notification.alert(message, callback || function () {
        }, title, 'OK');
    };
    var showError = function(message) {
        showAlert(message, 'Error occured');
    };
    window.addEventListener('error', function (e) {
        e.preventDefault();
        var message = e.message + "' from " + e.filename + ":" + e.lineno;
        showAlert(message, 'Error occured');
        return true;
    });

    var onBackKeyDown = function(e) {
        e.preventDefault();
        navigator.notification.confirm('Do you really want to exit?', function (confirmed) {
            var exit = function () {
                navigator.app.exitApp();
            };
            if (confirmed === true || confirmed === 1) {
                AppHelper.logout().then(exit, exit);
            }
        }, 'Exit', 'Ok,Cancel');
    };
    var onDeviceReady = function() {
        //Handle document events
        document.addEventListener("backbutton", onBackKeyDown, false);
    };

    document.addEventListener("deviceready", onDeviceReady, false);

    // initialize Everlive SDK
    var el = new Everlive({
        apiKey: "wEx9wdnIcxxehNty"
    });
    
    // Lookup object we'll be using to map file
    // extension to mime type values
    var mimeMap = {
        jpg  : "image/jpeg",
        jpeg : "image/jpeg",
        png  : "image/png",
        gif  : "image/gif"
    };

    var AppHelper = {
        // produces the 'download' url for a given
        // file record id. This allows us, for ex,
        // to src an image in an img tag, etc.
        resolveImageUrl: function (id) {
            if (id) {
                return el.Files.getDownloadUrl(id);
            }
            else {
                return '';
            }
        },
        // helper function to produce the base64
        // for a given file input item
        getBase64ImageFromInput : function (input, cb) {
            var reader = new FileReader();
            reader.onloadend = function (e) {
                if (cb)
                    cb(e.target.result);
            };
            reader.readAsDataURL(input);
        },
        // produces the appropriate object structure
        // necessary for Everlive to store our file
        getImageFileObject: function(input, cb) {
            var name = input.name;
            var ext = name.substr(name.lastIndexOf('.') + 1).toLowerCase();
            var mimeType = mimeMap[ext];
            if(mimeType) {
                this.getBase64ImageFromInput(input, function(base64) {
                    var res = {
                        "Filename"    : name,
                        "ContentType" : mimeType,              
                        "base64"      : base64.substr(base64.lastIndexOf('base64,')+7)
                    };
                    cb(null, res);
                });
            } else {
                cb("File type not supported: " + ext);    
            }
        }
    };

    var mobileApp = new kendo.mobile.Application(document.body, { transition: 'slide', layout: 'mobile-tabstrip' });
    
    var imagesViewModel = (function () {
        var imageModel = {
            id: 'Id',
            fields: {
                Title: {
                    field: 'Title',
                    defaultValue: ''
                },
                Picture: {
                    fields: 'Picture',
                    defaultValue: ''
                }
            },
            PictureUrl: function () {
                return AppHelper.resolveImageUrl(this.get('Picture'));
            }
        };
        var imagesDataSource = new kendo.data.DataSource({
            type: 'everlive',
            schema: {
                model: imageModel
            },
            transport: {
                typeName: 'Images'
            },
            change: function (e) {
                if (e.items && e.items.length > 0) {
                    $('#no-images-span').hide();
                }
                else {
                    $('#no-images-span').show();
                }
            },
            sort: { field: 'Title', dir: 'asc' }
        });
        return {
            images: imagesDataSource
        };
    }());
    
    var $newPicture;
    
    everloader.configure({
        apiKey: "wEx9wdnIcxxehNty"
    });
  
    var addImageViewModel = {
        picName: '',
        picTitle: '',
        picSelected: false,
        onPicSet: function(e) {
            this.set('picSelected', true);
            this.set('picName', e.target.files[0].name);
        },
        onRemovePic: function() {
            this.set("picSelected", false);
            // reset the file upload selector
            $newPicture = $newPicture || $("#newPicture");
            $newPicture.replaceWith($newPicture = $newPicture.clone(true));
        },
        onAddPic: function() {
            $newPicture = $newPicture || $("#newPicture");
            $newPicture.click();
        },
        saveItem: function() {
            var that = this;
            everloader
                .upload()
                .then(function(data) {
                    var item = imagesViewModel.images.add();
                    item.Title = that.get('picTitle');
                    item.Picture = Object.keys(data.newPicture)[0];
                    imagesViewModel.images.one('sync', function () {
                        mobileApp.navigate('#:back');
                    });
                    imagesViewModel.images.sync();
                    // reset the form
                    that.set("picSelected", false);
                    $newPicture.replaceWith($newPicture = $newPicture.clone(true));
                }, function(data) {
                    var msg = JSON.stringify(data.errors, null, 2);
                    alert("There was a problem:\n" + msg);    
                });
        }
    };

    return {
        viewModels: {
            images: imagesViewModel,
            addImage : addImageViewModel
        }
    };
}());