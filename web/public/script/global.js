__base = "../";

/*
https://github.com/danwild/leaflet-fa-markers
Copyright 2017 Daniel Wild danwild@y7mail.com
http://www.apache.org/licenses/LICENSE-2.0
*/


L.Icon.FontAwesome = L.Icon.extend({

    options: {
        popupAnchor: [0, -50]
    },

    createIcon: function () {

        var div = document.createElement('div');
        var options = this.options;

        if(options.iconClasses) {
            div.appendChild(this._createIcon());
        }

        return div;
    },

    _createIcon: function () {

        var options = this.options;

        // container div
        var iconDiv = L.DomUtil.create('div', 'leaflet-fa-markers');

        // feature icon
        var iconSpan = L.DomUtil.create('span', options.iconClasses + ' feature-icon');
        iconSpan.style.color = options.iconColor;
        iconSpan.style.textAlign = 'center';

        // XY position adjustments
        if(options.iconYOffset && options.iconYOffset != 0) iconSpan.style.marginTop = options.iconYOffset + 'px';
        if(options.iconXOffset && options.iconXOffset != 0) iconSpan.style.marginLeft = options.iconXOffset + 'px';

        // marker icon L.DomUtil doesn't seem to like svg, just append out html directly
        var markerSvg = document.createElement('div');
        markerSvg.className = "marker-icon-svg";
        markerSvg.innerHTML = '<svg ' +
            'width="32px" ' +
            'height="52px" ' +
            'viewBox="0 0 32 52" ' +
            'version="1.1" ' +
            'xmlns="http://www.w3.org/2000/svg" ' +
            'xmlns:xlink="http://www.w3.org/1999/xlink">' +
            '<path d="'+options.markerPath+'" ' +
            'fill="'+ options.markerColor + '" stroke="' + options.markerStroke + '"></path>' +
            '</svg>';


        iconDiv.appendChild(markerSvg);
        iconDiv.appendChild(iconSpan);
        return iconDiv;
    }
});

L.icon.fontAwesome = function (options) {
    return new L.Icon.FontAwesome(options);
};

L.Icon.FontAwesome.prototype.options.markerPath = 'M16,1 C7.7146,1 1,7.65636364 1,15.8648485 C1,24.0760606 16,51 16,51 C16,51 31,24.0760606 31,15.8648485 C31,7.65636364 24.2815,1 16,1 L16,1 Z';

var LX = window.LX || {};
window.LX = LX;

LX.Model = (function() {

	var db_host = "37bd9e99-2780-4965-8da8-b6b1ebb682bc-bluemix.cloudant.com";
	var web_host = window.location.host.replace(":3000", ":8080")
	var self = {};



	//----------------------------------------------------------------- Pre-defined Data
	self.getFilterTypes = function() {
		return [
			{"id": "place", "name": "Places", "active": true},
			{"id": "vehicle", "name": "Vehicles", "active": true},
			{"id": "request", "name": "Requests", "active": true},
			{"id": "fire", "name": "Fires"}
		];
	}

	self.getUnitedStatesGeohash = function() {
		return ["9z", "dn", "c8", "fo"];
	}

	

	//----------------------------------------------------------------- Conversational
	function postToAPI(route, data) {
		var json_data = JSON.stringify(data);

		console.log(json_data);
		return fetch(window.location.protocol + "//" + web_host + "/api/" + route, {
        		method: "POST",
        		cors: true, 
        		headers: {
      				"Accept": "application/json",
      				"Content-Type": "application/json"
    			},
        		body: json_data
			})
			.then(function(response) {
			  	return response.json();
			})
	}

	self.sendMessage = function(text) {
		return postToAPI("message", {"text": text});
	}

	self.getLocationsFromName = function(text) {
		return postToAPI("geocode", {"text": text});
	}

	self.getNamesFromLocation = function(pos) {
		return postToAPI("reverse_geocode", {
			"latitude": pos.coords.latitude,
			"longitude": pos.coords.longitude 
		});
	}


	self.getNamesFromGeohash = function(geohash) {
		var latlon = Geohash.decode(geohash);
		return postToAPI("reverse_geocode", {
			"latitude": latlon.lat,
			"longitude": latlon.lon
		});
	}



	//----------------------------------------------------------------- Database Interactions
	self.getDatabase = function(name, username, password) {
		var db_uri = "https://" +db_host+"/"+name;
		if (username && password) {
			db_uri = db_uri.replace("://", "://"+username+":"+password+"@");
		}
		console.log(db_uri);
		return new PouchDB(db_uri);
	}

	self.db = {};
	self.db.network = self.getDatabase("lantern-boston-flood-scenario");
	self.db.weather = self.getDatabase("lantern-nexus");



	//----------------------------------------------------------------- Document Access

	self.findActiveEvents = function() {
		return self.db.network.query("event/by_status", {
			key: 1,
		});
	}

	self.findPendingRequests = function(geohash) {
		console.log(geohash);
		return self.db.network.query("request/by_geo", {

		});
	}

	self.findPlaces = function() {
		return self.db.network.query("venue/by_geo", {
			startkey: ["bld"],
			endkey: ["tmp", {}]
		});
	}

	self.findVehicles = function() {
		return self.db.network.query("venue/by_geo", {
			startkey: ["trk"],
			endkey: ["trk", "\ufff0"]
		});
	}

	self.findWeather = function(id, geo_prefix) {
		return self.db.weather.query(id+"/by_geo", {
			startkey: geo_prefix,
			endkey: geo_prefix+"\ufff0",
			reduce: true, 
			group: true
		});
	}


	//-----------------------------------------------------------------
	return self;
})();
var LX = window.LX || {};
window.LX = LX;

function findObjectIndexByKey(array, key, value) {
    for (var i = 0; i < array.length; i++) {
        if (array[i][key] === value) {
            return i;
        }
    }
    return null;
}

LX.View = (function() {
	var self = {
        show: {},
        hide: {}
    };


	//----------------------------------------------------------------- Map Interface


    function getMyLocation() {
        return new Promise(function(resolve, reject) {
            navigator.geolocation.getCurrentPosition(function(position) {
                resolve(position);
            }, function(err) {
                reject(err);
            }, {
                enableHighAccuracy: false, 
                maximumAge        : 30000, 
                timeout           : 27000
            });
        });
    }

	self.Map = L.map('map').setView([38.42,-102.79], 4);


    // we're going to keep layer data for the map here
    self.Layers = {};




	self.showMap = function(svg) {

        var tiles, uri, opts;

		console.log("[view] render and center on united states");
        uri = "https://maps.tilehosting.com/c/ade1b05a-496f-40d1-ae23-5d5aeca37da2/styles/streets/";

        opts = {
            attribution: false,
            maxZoom: 16,
            crossOrigin: true,
            accessToken: 'not-needed',
        }  
        if (svg) {
            opts.style = uri + "/style.json?key=ZokpyarACItmA6NqGNhr";
            tiles = L.mapboxGL(opts)
        }
        else {
            tiles = L.tileLayer(uri+"{z}/{x}/{y}.png?key=ZokpyarACItmA6NqGNhr", opts)
        }

        console.log(tiles)

        tiles.addTo(self.Map)

	}


	//----------------------------------------------------------------- Fire Layers

    function showFire(row, layer_group) {

        //console.log("[view] draw region at %s with scale of %s", row.key, row.value);
        var latlon = Geohash.decode(row.key);

        var opts = {
            color: "red",
            radius: 200*row.value
        }

        var circle = L.circle(latlon, opts)
        layer_group.addLayer(circle).addTo(self.Map);
        circle.bringToBack();
    }



	self.show.fire = function() {
		console.log("[view] show fire");


        // @todo united states and nearby only for now
        LX.Model.getUnitedStatesGeohash().forEach(function(gh) {

            if (!self.Layers.fire[gh]) {
                self.Layers.fire[gh] = L.layerGroup();
            }

            if (!self.Layers.fire[gh].getLayers().length) {
                console.log("[view] looking for fire:" +  gh)
                LX.Model.findWeather("fire", gh)
                    .then(function(response) {
                        response.rows.forEach(function(row) {
                            showFire(row, self.Layers.fire[gh]);
                        });
                    });
            }
            
            self.Map.addLayer(self.Layers.fire[gh]);
            
        });
	}

	self.hide.fire = function() {
		console.log("[view] hide fire");
        for (var idx in self.Layers.fire) {
            self.Map.removeLayer(self.Layers.fire[idx]);
        }
	}

    //----------------------------------------------------------------- Chat Interface
    function scrollChat() {
        var chat = document.getElementById('message-container'); 
        chat.scrollTop = chat.scrollHeight;
    }

    //----------------------------------------------------------------- Place Layers

    function showPlace(row, layer_group) {
        var latlon = Geohash.decode(row.key[1]);
        var opts = {};
        var icon = "bed";
        opts.icon = L.icon.fontAwesome({ 
            iconClasses: 'fa fa-'+icon,
            markerColor: "#FFAD00",
            iconColor: '#FFF'
        });

        var marker = L.marker(latlon, opts);
        layer_group.addLayer(marker).addTo(self.Map);
    }


    self.show.place = function() {
        console.log("[view] show place");

        if (!self.Layers.place.all) {
            self.Layers.place.all = L.layerGroup();
        }

        if (!self.Layers.place.all.getLayers().length) {
            LX.Model.findPlaces()
                .then(function(response) {
                    console.log("PLACES", response)
                    response.rows.forEach(function(row) {
                        showPlace(row, self.Layers.place.all);
                    });
                });
        }

        self.Map.addLayer(self.Layers.place.all);
    }


    self.hide.place = function() {
        console.log("[view] hide place");
        self.Map.removeLayer(self.Layers.place.all);
    }



    self.show.request = function() {
        console.log("[view] show requests");
    }

    self.hide.request = function() {
        console.log("[view] hide requests");
    }


    //----------------------------------------------------------------- Vehicle Layers

    function showVehicle(row, layer_group) {
        var latlon = Geohash.decode(row.key[1]);
        var opts = {};
        var icon = "truck";
        opts.icon = L.icon.fontAwesome({ 
            iconClasses: 'fa fa-'+icon,
            markerColor: "#6FB1FA",
            iconColor: '#FFF',
        });

        var marker = L.marker(latlon, opts);
        layer_group.addLayer(marker).addTo(self.Map);
    }


    self.show.vehicle = function() {
        console.log("[view] show vehicle");

        if (!self.Layers.vehicle.all) {
            self.Layers.vehicle.all = L.layerGroup();
        }

        if (!self.Layers.vehicle.all.getLayers().length) {
            LX.Model.findVehicles()
                .then(function(response) {
                    response.rows.forEach(function(row) {
                        showVehicle(row, self.Layers.vehicle.all);
                    });
                });
        }

        self.Map.addLayer(self.Layers.vehicle.all);
    }


    self.hide.vehicle = function() {
        console.log("[view] hide vehicle");
        self.Map.removeLayer(self.Layers.vehicle.all);
    }

    //----------------------------------------------------------------- Conversation

    var transforms = {
        "timed_greeting": function() {

            var d = new Date();
            var time = d.getHours();

            if (time < 12)  {
                return Promise.resolve("Good morning");
            }
            else if (time > 17) {
              return Promise.resolve("Good evening");
            }
            else if (time > 12) {
              return Promise.resolve("Good afternoon");
            } 
            else if (time == 12)  {
                document.write("Hello");
            }
        },
        "active_events": function() {
            return LX.Model.findActiveEvents().then(function(results) {
                var count = results.rows.length;
                var cities = [];

                var fns = [];

                results.rows.forEach(function(row) {
                    var fn = LX.Model.getNamesFromGeohash(row.value.gp[0]).then(function(names) {
                        if (names.results[0].city) {
                            cities.push(names.results[0].city);                            
                        }
                    });
                    fns.push(fn);
                });

                return Promise.all(fns).then(function() {
                    addBotMessage("You can say: " + cities.join(", "), 300);
                    return [count, "active", (count == 1 ? "event" : "events")].join(" ");
                });

            });
        },
        "pending_request_count": function() {
            return LX.Model.findPendingRequests($data.target_geohash).then(function(results) {
                console.log(results);
                // @todo use above data
                var count = 49;
                return [count, "unattended", (count == 1 ? "request" : "requests"), "for supplies"].join(" ");
            })
        },
        "categorized_data": function() {
            return Promise.resolve("the most needed supply item is Water and least needed is Medical");
        },
        "suggested_location": function() {
            return Promise.resolve("Roxbury");
        },
        "suggested_supply_type": function() {
            return Promise.resolve("medical");
        },
        "darkzone_location": function() {
            return Promise.resolve("Dorchester");
        }
    }
  


    function addBotMessage(text, second_delay) {

        if (!text) { 
            console.log("[view] skip empty bot message");
            return; 
        }
        console.log("[view] add bot message: " + text);

        function replaceMessageVariable(match) {
            var tpl_var = match[0];
            var str = match[1]

            return new Promise(function(resolve, reject) {
                if (transforms.hasOwnProperty(str)) {
                    transforms[str](tpl_var).then(function(tpl_val) {
                        text = text.replace(tpl_var, tpl_val);
                        resolve(text);
                    })
                }
                else {
                    resolve(text)
                }
            });
        }


        // run text through variable converter before returning
        
        let reg = /#{([A-Za-z_]*)}/g;

        let match;

        var fns = [];
        while (match = reg.exec(text)) {
            var fn = replaceMessageVariable(match);
            fns.push(fn);
        }

        Promise.all(fns)
            .then(function() {
                setTimeout(function() {      
                    $data.messages.push({
                        "me": false,
                        "text": text
                    });
                    setTimeout(scrollChat, 10);
                }, second_delay);
            });
    }

    function actOnReply(reply) {
        

        if (reply.intents.length) {
            var main_intent = reply.intents[0].intent;
            console.log(main_intent);
            console.log(reply);
        }

        
        addBotMessage(reply.output.text.join(" "));
        
        if (main_intent == "map-display" || main_intent == "place-only" || main_intent == "map-zoom-in-place") {
            var location = "";
            reply.entities.forEach(function(entity) {
                if (entity.location) {
                    console.log("appending location", entity.value);
                    if (location) {
                        location += " ";
                    }
                    location += entity.value;
                }
            });
            if (location.length) {
                actOnLocation(location).then(function() {
                    if (main_intent == "map-zoom-in-place") {
                        actOnZoomInPlace();
                    }
                })
            }
        }
        else if (main_intent == "map-display-near-me") {
            getMyLocation()
                .then(actOnMyLocation);
        }
        else if (main_intent == "map-zoom-in") {
            actOnZoomIn();
        }
        else if (main_intent == "map-zoom-out") {
            actOnZoomOut();
        }
            

    }

    function actOnZoomInPlace() {

        setTimeout(function() {
            self.Map.setZoom(self.Map.getZoom()+2);
            addBotMessage("The most needed item here is clothing.");
        }, 1000);
    }

    function actOnZoomIn() {

        self.Map.setZoom(self.Map.getZoom()+2); 
    }

    function actOnZoomOut() {

        self.Map.setZoom(self.Map.getZoom()-2); 
    }

    function actOnMyLocation(pos) {
        
        self.Map.setView([pos.coords.latitude, pos.coords.longitude], 13);

        LX.Model.getNamesFromLocation(pos)
            .then(function(data) {
                console.log("found name", pos, data);

                if (data.results.length) {
                    var name = data.results[0].display_name;
                    addBotMessage("Now showing " + name + " on the map.");
                }
                else {
                    addBotMessage("Now showing a location near you on the map.");
                }
                
            });
    }

    function actOnLocation(name) {
        console.log("[view] find on map: " + name);
        return LX.Model.getLocationsFromName(name).then(function(data) {
            var pick = data.results[0];
            var zoom_level = 4 + (pick.place_rank)/2;
            var coords = [pick.lat, pick.lon];
            console.log("coords for new map spot:", pick, coords);
            self.Map.setView(coords, zoom_level);
            //addBotMessage( "Now showing " + pick.display_name + " on the map.", 0);

        });
    }




    //----------------------------------------------------------------- Map Layers
    LX.Model.getFilterTypes().forEach(function(type) {
        self.Layers[type.id] = {};
        if (type.active === true) {
            self.show[type.id]();
        }
    })



	//----------------------------------------------------------------- Vue Interface

	self.Vue = new Vue({
        data: {
            filters: LX.Model.getFilterTypes(),
            message: "",
            messages: [],
            target_geohash: "drt2z"
        },
        methods: {
        	toggleFilter: function(filter) {
        		Vue.set(filter, "active", !filter.active);

                if (filter.active) {
                    self.show[filter.id]();
                }
                else {
                    self.hide[filter.id]();
                }  
        	},
            chatMessageSubmit: function() {
                console.log($data.message);
                $data.messages.push({
                    "me": true,
                    "text": $data.message
                });


                LX.Model.sendMessage($data.message).then(actOnReply);

                // always scroll to bottom after sending message
                setTimeout(scrollChat, 10);
                $data.message = "";
            }
        },
        mounted: function() {
        	self.showMap();
            LX.Model.sendMessage("status").then(actOnReply);
        }
    });

    var $data = self.Vue.$data;
    
    self.Vue.$mount("#app");

	return self;
})();

