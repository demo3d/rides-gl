(function() {
	'use strict';

	rideMap.buildMap = buildMap;
	
	var updateTimeout;
	var needsUpdate = true;
	var lastStartDate, lastEndDate;

	/**
	 * Loads the style and builds the mapbox gl map
	 *
	 * returns promise
	 */
	function buildMap() {

		var map;
		var dfd = new jQuery.Deferred();
		var startDate = {};
		var endDate = {};
		
		mapboxgl.util.getJSON('rides_electric_base.json', function (err, style) {
			if (err) throw err;
	
			// add ride layers
			style.layers = style.layers.concat(_createAllRideLayers());

			// init the map
			map = rideMap.map = new mapboxgl.Map({
				container: 'map',
				style: style,
				center: [29.8752, -95.9683],
				zoom: 9
			});
			
			// add the compass
			map.addControl(new mapboxgl.Navigation());
			
			var quickTimeout;
			$(document).bind("slider-range-end", function(event, date) {
				endDate = date;
				// prevent updates if the slider moves too fast
				clearTimeout(quickTimeout);
				quickTimeout = setTimeout(function() {
					_showAllBetween(startDate, endDate);
				}, 1);
			});

			$(document).bind("slider-range-start", function(event, date) {
				startDate = date;
				// prevent updates if the slider moves too fast
				clearTimeout(quickTimeout);
				quickTimeout = setTimeout(function() {
					_showAllBetween(startDate, endDate);
				}, 1);
			});

			dfd.resolve(map);
		});

		return dfd.promise();
	}

	/**
	 * Generates the layers for a given ride
	 */
	function _createRideLayers(rideName) {
		var baseLayer = {
			"id": rideName,
			"type": "line",
			"source": "vector",
			"source-layer": "ride_gpx_tracks",
			"filter": ["==", "name", rideName],
			"paint": {
				"line-color": "rgb(67, 222, 252)",
				"line-opacity": 0
			}
		};
	
		var topLayer = {
			"id": rideName + "-heat",
			"type": "line",
			"source": "vector",
			"source-layer": "ride_gpx_tracks",
			"filter": ["==", "name", rideName],
			"paint": {
				"line-color": "rgb(255, 255, 255)",
				"line-opacity": 0
			}
		};
	
		var highlightLayer = {
			"id": rideName + "-highlight",
			"type": "line",
			"source": "vector",
			"source-layer": "ride_gpx_tracks",
			"filter": ["==", "name", rideName],
			"paint": {
				"line-color": "rgb(250, 35, 241)",
				"line-width": 3,
				"line-blur": 2,
				"line-opacity": 0
			}
		};
	
		// add the active classes
		baseLayer["paint." + rideName + "_active"] = {"line-opacity": 0.4}
		topLayer["paint." + rideName + "_active"] = {"line-opacity": 0.1}
		highlightLayer["paint." + rideName + "_highlight"] = {"line-opacity": 1}
	
		return { 
			"baseLayer": baseLayer, 
			"topLayer": topLayer, 
			"highlightLayer": highlightLayer
		};
	}

	/**
	 * Create all ride layers
	 */
	function _createAllRideLayers() {
		var 
		    rideBaseLayers = [],
		    rideTopLayers = [],
		    rideHighlightLayers = [],
		    allLayers = [];
		
		for (var i=0;i<rideMap.rides.length;i++) {
			var rideName = rideMap.rides[i].name;
			var rideLayers = _createRideLayers(rideName);
			
			rideBaseLayers.push(rideLayers.baseLayer);
			rideTopLayers.push(rideLayers.topLayer);
			rideHighlightLayers.push(rideLayers.highlightLayer);
		}
		
		allLayers = allLayers.concat(rideBaseLayers, rideTopLayers, rideHighlightLayers);
	
		return allLayers;
	}

	/**
	 * Shows all rides for the specified period
	 */
	function _showAllBetween(startDate, endDate) {
		// set dates to midnight boundary
		lastStartDate = startDate = d3.time.day.floor(startDate);
		lastEndDate = endDate = d3.time.day.floor(endDate);
		
		// ensure updates at a max of 100ms frequency
		if (!needsUpdate) return;
		needsUpdate = false;

		updateTimeout = setTimeout(function() {
			needsUpdate = true;

			if (lastStartDate != startDate || lastEndDate != endDate) {
				_showAllBetween(lastStartDate, lastEndDate);
			}
		}, 100);

		// show the selected layers
		var classes = [];
		var dates = rideMap.dates;
		var startIndex = d3.time.days(dates[0].date, startDate).length; 
		var endIndex = d3.time.days(dates[0].date, endDate).length;
		for (var i = startIndex; i <= endIndex; i++) {
			var rides = dates[i].rides;
			for (var j = 0; j < rides.length; j++) {
				classes.push(rides[j] + '_active');
			}
		}
		
		rideMap.map.style.setClassList(classes); 
	}
})();