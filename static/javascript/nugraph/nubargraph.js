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
 * requires:    jquery
 *              nugraph.js
 */
(function(){

    function barChartPlotter(e) {
        var ctx = e.drawingContext;
        var points = e.points;
        var y_bottom = e.dygraph.toDomYCoord(0);
        var i;
        var color = new RGBColor(e.color);
        ctx.fillStyle = color.toRGB();
        // Find the minimum separation between x-values.
        // This determines the bar width.
        var min_sep = Infinity;
        for (i = 1; i < points.length; i++) {
            var sep = points[i].canvasx - points[i - 1].canvasx;
            if (sep < min_sep) min_sep = sep;
        }
        var bar_width = Math.floor(2.0 / 3 * min_sep);

        // Do the actual plotting.
        for (i = 0; i < points.length; i++) {
            var p = points[i];
            var center_x = p.canvasx;
            // The RGBColor class is provided by rgbcolor.js, which is
            // packed in with dygraphs.

            ctx.fillRect(center_x - bar_width / 2, p.canvasy,
                bar_width, y_bottom - p.canvasy);

            ctx.strokeRect(center_x - bar_width / 2, p.canvasy,
                bar_width, y_bottom - p.canvasy);
        }
    }
    /**
     * Standard bar chart.
     * @param elementId
     * @param data
     * @param options
     * @constructor
     */
    function NuBarGraph(elementId, data, options) {
        NuGraph.call(this, elementId, data,
            $.extend({}, {
                plotter: barChartPlotter
            }, options));
    }
    NuBarGraph.prototype = GROK.util.heir(NuGraph.prototype);
    NuBarGraph.prototype.constructor = NuGraph;

    window.NuBarGraph = NuBarGraph;

})();