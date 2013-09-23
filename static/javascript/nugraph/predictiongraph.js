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
 *           nugraph.js
 */

(function(){

    var DEFAULT_OPTIONS = {
        showRangeSelector: true,
        colors: [NuGraph.PALETTE.blue, NuGraph.PALETTE.green],
        rightGap: 0
    };
    /**
     * Prediction graph.
     * @param elementId
     * @param modelOutput
     * @param options
     * @constructor
     */
    function PredictionGraph(elementId, modelOutput, options) {
        var formattedOutput = this._formatModelOutputData(modelOutput);
        var nugraphOptions = $.extend({
            labels: formattedOutput.labels
        }, DEFAULT_OPTIONS, options);
        NuGraph.call(this, elementId, formattedOutput.data, nugraphOptions);
    }
    PredictionGraph.prototype = GROK.util.heir(NuGraph.prototype);
    PredictionGraph.prototype.constructor = NuGraph;

    PredictionGraph.prototype._formatModelOutputData = function(modelOutput) {
        var meta = modelOutput.meta,
            outputData = [],
            outputLabels = [],
            temporalIndex,
            predictedFieldIndex,
            predictedFieldPredictionIndex,
            predictedFieldName,
            predictedFieldLabel;

        temporalIndex = meta.timestampIndex;
        predictedFieldIndex = meta.predictedFieldIndex;
        predictedFieldPredictionIndex = meta.predictedFieldPredictionIndex;
        predictedFieldName = modelOutput.names[predictedFieldIndex];
        predictedFieldLabel = predictedFieldName.substring(0,
                                    predictedFieldName.indexOf(' (predicted)'));

        // build the labels
        outputLabels.push('Time');
        outputLabels.push(predictedFieldLabel);
        outputLabels.push('Predicted ' + predictedFieldLabel);

        // build the data
        modelOutput.data.forEach(function(dataRow, i) {
            var outputRow = [],
                value, prediction;

            if (i === 0 || i === modelOutput.data.length - 1) {
                return;
            }

            value = dataRow[predictedFieldIndex];
            prediction = dataRow[predictedFieldPredictionIndex];

            outputRow.push(NuGraph.parseGrokDateString(dataRow[temporalIndex]));
            outputRow.push(value === "" ? null : parseFloat(value));
            outputRow.push(prediction === "" ? null : parseFloat(prediction));
            outputData.push(outputRow);
        });
        return {
            labels: outputLabels,
            data: outputData
        };
    };

    window.PredictionGraph = PredictionGraph;
})();