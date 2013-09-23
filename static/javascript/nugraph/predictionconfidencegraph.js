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
 *              nubargraph.js
 */
(function(){

    var DEFAULT_OPTIONS = {
        colors: [NuGraph.PALETTE.blue],
        valueRange: [0, 1],
        rightGap: 0
    };

    /**
     * Prediction confidence graph.
     * @param elementId
     * @param modelOutput
     * @param options
     * @constructor
     */
    function PredictionConfidenceGraph(elementId, modelOutput, options) {
        var formattedOutput = this._formatModelOutputData(modelOutput);
        var nugraphOptions = $.extend({
            labels: formattedOutput.labels
        }, DEFAULT_OPTIONS, options);
        NuBarGraph.call(this, elementId, formattedOutput.data, nugraphOptions);
    }
    PredictionConfidenceGraph.prototype = GROK.util.heir(NuBarGraph.prototype);
    PredictionConfidenceGraph.prototype.constructor = NuBarGraph;

    PredictionConfidenceGraph.prototype._formatModelOutputData = function(modelOutput) {
        var predictionDetailsLabel = 'Prediction Details',
            meta = modelOutput.meta,
            outputData = [],
            outputLabels = ['Time', 'Confidence'],
            temporalIndex = meta.timestampIndex,
            predictedFieldPredictionIndex = meta.predictedFieldPredictionIndex,
            predictionDetailsIndex = modelOutput.names.indexOf(predictionDetailsLabel);

        modelOutput.data.forEach(function(dataRow, i) {
            var details, hackedDetails;
            var prediction;
            var rawConfidence, confidence;

            // Ignores the first and last points, which contain the first value
            // and the last 'dangling' prediction.
            if (i === 0 || i === modelOutput.data.length - 1) {
                return;
            }

            // The replace gets rid of the double quotes put into place by the
            // CSV formatting.
            details = dataRow[predictionDetailsIndex];
            prediction = parseFloat(dataRow[predictedFieldPredictionIndex]);

            if (details) {
                // Hack for http://jira.numenta.com:8080/browse/NUP-1477#comment-27926
                // Must go through all the prediction details and round out the keys to the same
                // decimal space as the prediction.
                hackedDetails = {};
                Object.keys(details[1]).forEach(function(key) {
                    hackedDetails[parseFloat(key).toFixed(3)] = details[1][key];
                });
                rawConfidence = hackedDetails[prediction.toFixed(3)];
                if (rawConfidence) {
                    confidence = parseFloat(rawConfidence);
                }
            }
            outputData.push([
                NuGraph.parseGrokDateString(dataRow[temporalIndex]),
                confidence
            ]);
        });
        return {
            labels: outputLabels,
            data: outputData
        };
    };

    window.PredictionConfidenceGraph = PredictionConfidenceGraph;

})();