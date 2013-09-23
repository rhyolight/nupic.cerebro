/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2013 Numenta, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

/*
 * requires: jquery
 */
(function() {

    var PALETTE = {
        blue: '#1f78b4',
        green: '#33a02c',
        red: '#e31a1c'
    };

    var DEFAULT_OPTIONS = {
        width: 800,
        height: 600
    };

    var DYGRAPH_CALLBACKS = [
        'click', 'draw', 'highlight', 'pointClick',
        'underlay', 'unhighlight', 'zoom'
    ];

    /**
     * NuGraph is an extension of Dygraph, with some sensible defaults for
     * Numenta's use cases as well as one major variation from the Dygraph use
     * case: creating a NuGraph object will not render a chart. It will
     * construct a chart object, but the Dygraph constructor will not be called
     * until the render() function is called.
     *
     * Another ability of NuGraph the Dygraph lacks is the ability to specify
     * multiple callback functions for each event a chart might emit. The
     * Dygraph only allows one callback to be specified for each event that it
     * might emit. NuGraph provides an 'on' function so users can register
     * multiple functions as callbacks.
     *
     * This standard implementation uses the default Dygraph plotter. For other
     * graphs other than line graphs, you must provide a 'plotter' function
     * within the options. You can also use the NuBarGraph class for bar charts.
     *
     * @param elementId
     * @param data
     * @param options
     * @constructor
     */
    function NuGraph(elementId, data, options) {
        var me = this,
            mainCallbacks = {};

        this._listeners = {};
        this._drawn = false;

        DYGRAPH_CALLBACKS.forEach(function(CB) {
            // For each dygraph callback, we'll create a function that will emit
            // an event for the callback type, allowing users to use the on()
            // function on NuGraph instances to register multiple event
            // listeners.
            var cbName = CB + 'Callback';
            mainCallbacks[cbName] = function() {
                var args = Array.prototype.slice.call(arguments, 0);
                args.unshift(CB);
                // Keeping track of whether this graph has been rendered yet or
                // not.
                if (CB === 'draw') {
                    me._drawn = true;
                }
                me._emit.apply(me, args);
            };
            // We'll also handle the case where users have specified a callback
            // directly like options.zoomCallback, which is the typical dygraph
            // way of specifying one callback.
            if (options[cbName]) {
                me.on(CB, options[cbName]);
            }
        });

        // Stash options so we can use them for Dygraph construction when we
        // render().
        this._args = [
            document.getElementById(elementId),
            data,
            $.extend({}, DEFAULT_OPTIONS, options, mainCallbacks)
        ];
    }
    NuGraph.prototype = GROK.util.heir(Dygraph.prototype);
    NuGraph.prototype.constructor = Dygraph;

    /**
     * Currently emits all Dygraph callback events: 'click', 'draw',
     * 'highlight', 'pointClick', 'underlay', 'unhighlight', and 'zoom'.
     * @param event
     * @param callback
     */
    NuGraph.prototype.on = function(event, callback) {
        if (! callback || ! event) { return; }
        if (! this._listeners[event]) {
            this._listeners[event] = [];
        }
        this._listeners[event].push(callback);
    };

    NuGraph.prototype._emit = function() {
        var me = this,
            args = Array.prototype.slice.call(arguments, 0),
            event = args.shift();
        if (this._listeners[event]) {
            this._listeners[event].forEach(function(listener) {
                listener.apply(me, args);
            });
        }
    };

    NuGraph.parseGrokDateString = function(dateTimeString) {
        var dateOut, dateTimeParts, dateParts, timeParts;
        // if the date string is parse-able, it will not return NaN,
        // and we can just create a Date normally
        if (! isNaN(Date.parse(dateTimeString))) {
            dateOut = new Date(dateTimeString);
        } else {
            dateTimeParts = dateTimeString.split(' ');
            dateParts = dateTimeParts.shift().split('-');
            timeParts = dateTimeParts.shift().split(':');
            dateOut = new Date(
                parseInt(dateParts[0], 10),     // year
                parseInt(dateParts[1], 10) - 1, // month
                parseInt(dateParts[2], 10),     // day
                parseInt(timeParts[0], 10),     // hours
                parseInt(timeParts[1], 10),     // minutes
                parseInt(timeParts[2], 10)      // seconds
            );
        }
        return dateOut;
    };

    /**
     * Syncs one NuGraph to another. When the x or y axis changes, this will
     * sync the charts together.
     * @param otherNuGraph
     * @param options
     */
    NuGraph.prototype.syncTo = function(otherNuGraph, options) {
        var me = this;
        options = options || {};
        otherNuGraph.on('draw', function() {
            var updatedOptions;
            // In case the chart I'm syncing to is also synced with me
            if (me.blockRedraw) { return; }
            this.blockRedraw = true;
            updatedOptions = {
                dateWindow: otherNuGraph.xAxisRange()
            };
            if (options.syncY) {
                updatedOptions.valueRange = otherNuGraph.yAxisRange()
            }
            // If this chart has not been drawn yet, we need to wait until then
            // before we can update our options.
            if (! me._drawn) {
                me.on('draw', function(graph, isInitial) {
                    if (isInitial) { me.updateOptions(updatedOptions); }
                });
            } else {
                me.updateOptions(updatedOptions);

            }
            this.blockRedraw = false;
        });
    };

    /**
     * Syncs the highlighted points between to charts. When one point is
     * highlighted, the other will set the same selected point as highlighted,
     * which displays both graph legends at once.
     * @param otherNuGraph
     */
    NuGraph.prototype.syncLegendTo = function(otherNuGraph) {
        var me = this;
        var highlightTimeoutId;
        otherNuGraph.on('highlight', function(event, x, points, row) {
            me.setSelection(me._dataIndexOf(x));
            if (highlightTimeoutId) {
                clearTimeout(highlightTimeoutId);
                highlightTimeoutId = undefined;
            }
        });
        otherNuGraph.on('unhighlight', function() {
            // Only unhighlight if there is a short period without another
            // highlight event, which means that the user has moused off the
            // chart entirely.
            highlightTimeoutId = setTimeout(function() {
                me.clearSelection();
            }, 10);
        });
    };

    /**
     * When you call getSelection() on a dygraph, it gives you the row indexed
     * off the current zoom, when you really might want the row index from the
     * beginning of the data. This allows me to pass the x value into this
     * function to get the actual data index outside the zoomed window.
     * @param x
     * @return {Number}
     * @private
     */
    NuGraph.prototype._dataIndexOf = function(x) {
        var i = 0;
        var index = -1;
        for (; i < this.rawData_.length; i++) {
            if (x === this.rawData_[i][0]) {
                index = i;
                break;
            }
        }
        return index;
    };

    /**
     * Draws the chart by calling the Dygraph constructor.
     */
    NuGraph.prototype.render = function(options) {
        var renderOptions = $.extend({}, this._args[2], (options || {}));
        Dygraph.apply(this, [this._args[0], this._args[1], renderOptions]);
    };

    /**
     * Standard Numenta HTML color palette for charts.
     * @type {Object}
     */
    NuGraph.PALETTE = PALETTE;

    window.NuGraph = NuGraph;

})();