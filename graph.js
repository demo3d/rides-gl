(function() {
	"use strict";

	rideMap.buildGraph = buildGraph;

	var margin,
	    width,
	    height,
	    x, xAxis, gXAxis,
	    y, yAxis, gYAxis,
	    rightBuffer,
	    dayWidth,
	    rides, dates,
	    rangeSlider;

	var formatDate = d3.time.format("%b %-d");

	/**
	 * Builds the base DOM structure for the Graph.
	 * Loads the data and populates the UI when ready.
	 */
	function buildGraph() {
		// Set the dimensions of the canvas / graph
		margin = {top: 0, right: 45, bottom: 20, left: 45};
		width = $(window).width() - margin.left - margin.right;
		height = 110 - margin.top - margin.bottom;
		
		// since the rightmost bar has an actual width, we need a small buffer after axis end
		rightBuffer = 5;
		
		rides = rideMap.rides;
		dates = rideMap.dates;

		// calculate the width of each bar
		dayWidth = (width-rightBuffer)/dates.length;

		// Add an SVG element with the desired dimensions and margin.
		var canvas = d3.select("#map-controls")
			.append("svg")
			.attr("width", width + margin.left + margin.right)
			.attr("height", height + margin.top + margin.bottom)
			.attr("id", "graph")
			.append("g")
			.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

		var axesLayer = canvas.append("g").attr("class", "axes-layer");
		var sliderLayer = canvas.append("g").attr("class", "slider-layer");
		var graphLayer = canvas.append("g").attr("class", "graph-layer");

		// Set the scales
		x = d3.time.scale()
			.range([0, width-rightBuffer])
			.domain(d3.extent(rides, function(d) { return d.date; }))
			.nice(d3.time.hour);

		y = d3.scale.linear()
			.range([height, 0])
			.domain([0, d3.max(dates, function(d) { return d.length; })])
			.nice();

		// Define the axes
		xAxis = d3.svg.axis()
			.scale(x)
			.orient("bottom")
			.tickSize(4)
			.tickFormat( function (d) {
				if (d.getMonth() == 0) {
					return (d3.time.format("Jan '%y"))(d);
				} else {
					return (d3.time.format("%b"))(d);
				}
			})
			.ticks(d3.time.months);

		yAxis = d3.svg.axis()
			.scale(y)
			.tickSize(width)
			.orient("right")
			.tickFormat(function(d) { 
				if ( d > 0 && d % 100 == 0) {
					return d + " miles";
				} else if ( d > 0 && d % 50 == 0) {
					return d;
				} else {
					return "";
				}
			})
			.tickValues([0,25,50,75,100]);

		// Add the X Axis
		gXAxis = axesLayer.append("g")
			.attr("class", "x axis")
			.attr("transform", "translate(0," + height + ")")
			.call(xAxis);

		// Add the Y Axis
		gYAxis = axesLayer.append("g")
			.attr("class", "y axis")
			.call(yAxis)
			.call(customYTicks);
			
		// build the range slider
	  rangeSlider = buildRangeSlider(sliderLayer);
		
		graphLayer.selectAll(".bar")
      .data(dates)
			.enter().append("rect")
			.attr("class", "bar")
      .attr("x", function(d) { return x(d.date); })
      .attr("width", dayWidth)
      .attr("y", height)
      .attr("height", 0);
      
    var maxLen = d3.max(dates, function(d) { return d.length; });
    graphLayer.selectAll(".bar")
      .transition()
      .duration( function(d) { return 1500*d.length/maxLen; } )
      .delay( function(d,i) { return i/dates.length * 1000; } )
      .attr("y", function(d) { return y(d.length); })
      .attr("height", function(d) { return height - y(d.length); });

		// update the graph on resize
		d3.select(window).on('resize', function() {
			width = $(window).width() - margin.left - margin.right;
			dayWidth = (width-rightBuffer)/dates.length;

			// update the X axis
			x.range([0, width-rightBuffer]);
			gXAxis.call(xAxis);

			// update the slider
			var startDate = rangeSlider.start().value();
			var startPosX = x(startDate);
			var endDate = rangeSlider.end().value();
			var endPosX = x(endDate);
			rangeSlider.start().update(startPosX, true);
			rangeSlider.end().update(endPosX, true);
			rangeSlider.updateSelection();
			
			// update the bars
			graphLayer.selectAll(".bar")
				.attr("width", dayWidth)
				.attr("x", function(d) { return x(d.date); });
		});
	}

	/**
	 * Adjusts the position of the ticks on the Y axis
	 */
	function customYTicks(g) {
	  g.selectAll("text")
		  .attr("x", 2)
		  .attr("dy", -3);
	}

	/**
	 * builds the Range slider composed of two separate sliders and a selection marquee
	 */
	function buildRangeSlider(canvas) {
		var startDate = d3.time.day.offset(dates[dates.length-1].date, -90);
		var startSlider = buildSlider(x(startDate), "range-start", canvas);
		var endSlider = buildSlider(width - rightBuffer + dayWidth, "range-end", canvas);

		// constrain the slider to not past each other or the ends of the graph
		startSlider.constrain(function(event, ui) {
			ui.position.left = Math.min(ui.position.left, endSlider.pos() + margin.left);
			ui.position.left = Math.max(margin.left, ui.position.left);
		});

		endSlider.constrain(function(event, ui) {
			ui.position.left = Math.max(ui.position.left, startSlider.pos() + margin.left);
			ui.position.left = Math.min(margin.left + width - rightBuffer + dayWidth, ui.position.left);
		});

		var dragBehavior = d3.behavior.drag()
			.on("drag", onSelectionDrag);

		// build the selection window
		var selection =	 canvas.append("rect")
			.attr("id", "selection")
			.attr("class", "selection")
			.attr("x", startSlider.pos())
			.attr("y", 0 - margin.top)
			.attr("height", height + margin.top)
			.attr("width", endSlider.pos() - startSlider.pos())
			.call(dragBehavior);

		/**
		 * Slides the two sliders to the new positions using a transition
		 */
		function slideTo(newStart, newEnd, duration, callback) {
			var duration = duration || 2000;
			d3.transition()
				.duration(duration)
				.tween("moveTween", function () {
					var sI = d3.interpolateRound(startSlider.pos(), newStart),
						eI = d3.interpolateRound(endSlider.pos(), newEnd),
						_width = d3.select(this).attr("width");

					return function(t) {
						var iStart = sI(t),
							iEnd = eI(t);
						startSlider.update(iStart, true);
						endSlider.update(iEnd, true);
						updateSelection();
					}
				})
				.each("end", callback);
		}

		/**
		 * Updates the bounds of the selection marquee according to the positions of the sliders
		 */
		function updateSelection() {
			if (!selection) return;

			selection.attr("x", startSlider.pos());
			selection.attr("width", endSlider.pos() - startSlider.pos());
		}

		/**
		 * Handles dragging of the selection window
		 */
		function onSelectionDrag() {
			var $this = d3.select(this),
				currentX = +$this.attr("x"),
				sWidth = +$this.attr("width"),
				newX = currentX + d3.event.dx;

			// check bounds:
			if (newX < 0 || newX+sWidth > width - rightBuffer + dayWidth) return;

			selection.attr("x", newX);

			// update the slider, they will update the selection
			startSlider.update(newX, true);
			endSlider.update(newX + sWidth, true);
		}

		/**
		 * Builds a slider.
		 * The slider is a combination of draggable div(the thumb) & svg guideline driven with d3.js.
		 * There's two-way bind between the div and svg.
		 * If the user drags the thumb div, the svg graphics will be updated.
		 * If the svg guideline is being updated (we're using d3 transitions), the div is also updated.
		 */
		function buildSlider(myPos, sliderName, canvas) {
			var _pos = myPos;
			var _name = sliderName;
			var _value = 0;
			var _constrain;
			var controller = d3.select("#map-controls");

			var marker = canvas.append("g")
			    .attr("class", "marker " + _name);

			// add the guideline
			var guideline = marker.append("line")
					.attr("class", "guideline")
					.attr("x1", 0)
					.attr("y1", -height*2)
					.attr("x2", 0)
					.attr("y2", height*2);

			// builds the slider as div elements. this allows to have them outside of the svg bounds
			var slider = controller.append("div")
					.attr("class", "slider " + _name);

			var sliderThumb = slider.append("div")
					.attr("class", "slider-thumb")
					.style("left", _pos + margin.left + "px");

			var dateSpan = sliderThumb.append("span")
					.attr("class", "date");

			// add the scroll thumb. using jQ Draggable in order to have it outside the svg bounds
			$(".slider." + _name + " .slider-thumb").draggable({
				axis: "x",
				start : function() {
					$(this).closest(".slider").addClass("drag");
					marker.classed("drag", true);
					updateSelection();
				},
				drag: function(event, ui) {
					// check for constraints
					if (_constrain) {
						_constrain(event, ui);
					}
					updateSlider($(this).position().left - margin.left);
					updateSelection();
				},
				stop : function() {
					$(this).closest(".slider").removeClass("drag");
					marker.classed("drag", false);
					updateSlider($(this).position().left - margin.left);
					updateSelection();
				}
			});

			//init the marker:
			updateSlider(_pos, true);
			
			/**
			 * Updates the slider to match the specified position.
			 * This is usually called by the draggable thumb.
			 */
			function updateSlider(posX, updateThumb) {
				if (posX < 0 || posX > width) return;

				// update the slider x:
				_pos = posX;

				// update the div thumb, if the flag is set.
				// this happens when update() is not called from the thumb itself
				if (updateThumb) {
					$(".slider." + _name + " .slider-thumb").css({left: posX + margin.left});
				}

				marker.attr("transform", "translate(" + posX + "," + 0 + ")");

				var valueOffset = 0;
				if (_name == "slider-end") {
					valueOffset = -dayWidth;
				}

				var newValue = new Date(x.invert(posX+valueOffset));
				dateSpan.html(formatDate(newValue));

				// fire update event, if date has changed:
				if (_value != newValue) {
					$(document).trigger("slider-" + _name, newValue);
					_value = newValue;
				}

			}

			/**
			 * returns the current value of the slider
			 */
			function value() {
				return _value;
			}

			function pos() {
				return _pos;
			}

			/**
			 * Sets a new constrain callback
			 */
			function constrain(dragConstrain) {
				_constrain = dragConstrain;
			}

			return {
				constrain: constrain,
				update: updateSlider,
				value: value,
				pos: pos
			};
			
		} //buildSlider

		// RangeSlider interface
		return {
			slideTo: slideTo,
			start: function() { return startSlider; },
			end: function() { return endSlider; },
			updateSelection: updateSelection
		}
	}// buildRange
})();