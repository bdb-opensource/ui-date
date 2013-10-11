/*global angular, $ */
/*
 jQuery UI Datepicker plugin wrapper

 @note If ≤ IE8 make sure you have a polyfill for Date.toISOString()
 @param [ui-date] {object} Options to pass to $.fn.datepicker() merged onto uiDateConfig
 */

(function () {
    'use strict';
    /**
     * Wrapper for $.datepicker.parseDate, that tries using multiple input formats
     */
    function tryParseInputFormats(defaultFormat, elementValue, inputDateFormats) {
        var parsedDate = null;

        if ($.isDate(elementValue)) {
            // Already a Date.
            return elementValue;
        }

        if (!$.isArray(inputDateFormats)) {
            inputDateFormats = [defaultFormat];
        }

        $.each(inputDateFormats, function (index, format) {
            try {
                parsedDate = $.datepicker.parseDate(format, elementValue);
            } catch (e) {
                // ignore;
            }
        });
        return parsedDate;
    }

    /** 
     * wrapper for scope.$apply that avoids the "$apply already in progress" error.
     * see: http://stackoverflow.com/questions/12729122/prevent-error-digest-already-in-progress-when-calling-scope-apply
     */
    function safeApply(scope, fn) {
        if (scope.$$phase || scope.$root.$$phase) {
            fn();
            return;
        }
        scope.$apply(fn);
    }

    angular.module('ui.date', [])
        .constant('uiDateConfig', {})
        .directive('uiDate', ['uiDateConfig', '$timeout', function (uiDateConfig, $timeout) {
            var options;
            options = {};
            angular.extend(options, uiDateConfig);
            return {
                require: '?ngModel',
                link: function (scope, element, attrs, controller) {
                    function getOptions() {
                        return angular.extend({}, uiDateConfig, scope.$eval(attrs.uiDate));
                    }
                    
                    function initDateWidget() {
                        var opts = getOptions(),
                            settingValue = false,
                            _$setViewValue,
                            _onSelect = opts.onSelect || angular.noop,
                            _beforeShow = opts.beforeShow || angular.noop;

                        // If we have a controller (i.e. ngModelController) then wire it up
                        if (controller) {
                            // Override ngModelController's $setViewValue
                            // so that we can ensure that a Date object is being pass down the $parsers
                            // This is to handle the case where the user types directly into the input box
                            _$setViewValue = controller.$setViewValue;
                            
                            controller.$setViewValue = function (value) {
                                if (!settingValue) {
                                    settingValue = true;
                                    if (angular.isDate(value)) {
                                        element.datepicker("setDate", value);
                                        _$setViewValue.call(controller, value);
                                    } else {
                                        _$setViewValue.call(controller, null);
                                    }
                                    $timeout(function () {
                                        settingValue = false;
                                    });
                                }
                            };

                            element.on('blur', function () {
                                safeApply(scope, function () {
                                    var isValid = true,
                                        elementValue = element.val(),
                                        defaultFormat = element.datepicker("option", "dateFormats"),
                                        inputDateFormats = element.datepicker("option", "inputDateFormats"),
                                        parsedDate = tryParseInputFormats(defaultFormat, elementValue, inputDateFormats);
                                    if (!controller.$viewValue && elementValue) {
                                        if (parsedDate) {
                                            element.datepicker("setDate", parsedDate);
                                            _$setViewValue.call(controller, parsedDate);
                                        }
                                    }
                                    controller.$setValidity(controller.$name, !!(parsedDate));
                                });
                            });

                            // Set the view value in a $apply block when users selects
                            // (calling directive user's function too if provided)
                            opts.onSelect = function (value, picker) {
                                scope.$apply(function () {
                                    controller.$setViewValue(element.datepicker("getDate"));
                                    _onSelect(value, picker);
                                    element.blur();
                                });
                            };

                            // Don't show if we are already setting the value in $setViewValue()
                            // (calling directive user's function too if provided)
                            opts.beforeShow = function (input, inst) {
                                return !settingValue && _beforeShow(input, inst);
                            };

                            // Update the date picker when the model changes
                            controller.$render = function () {
                                var date = controller.$viewValue;
                                if (angular.isDefined(date) && date !== null && !angular.isDate(date)) {
                                    throw new Error('ng-Model value must be a Date object - currently it is a ' + typeof date + ' - use ui-date-format to convert it from a string');
                                }
                                element.datepicker("setDate", date);
                            };
                        }
                        // If we don't destroy the old one it doesn't update properly when the config changes
                        element.datepicker('destroy');
                        // Create the new datepicker widget
                        element.datepicker(opts);
                        if (controller) {
                            // Force a render to override whatever is in the input text box
                            controller.$render();
                        }
                    }
                    
                    // Watch for changes to the directives options
                    scope.$watch(getOptions, initDateWidget, true);
                }
            };
        }])
        .constant('uiDateFormatConfig', '')
        .directive('uiDateFormat', ['uiDateFormatConfig', function (uiDateFormatConfig) {
            var directive = {
                require: 'ngModel',
                link: function (scope, element, attrs, modelCtrl) {
                    var dateFormat = attrs.uiDateFormat || uiDateFormatConfig;
                    if (dateFormat) {
                        // Use the datepicker with the attribute value as the dateFormat string to convert to and from a string
                        modelCtrl.$formatters.push(function (value) {
                            return tryParseInputFormats(dateFormat, value, element.datepicker("option", "inputDateFormats"));
                        });
                        modelCtrl.$parsers.push(function (value) {
                            if (angular.isDate(value)) {
                                return $.datepicker.formatDate(dateFormat, value);
                            }
                            return null;
                        });
                    } else {
                        // Default to ISO formatting
                        modelCtrl.$formatters.push(function (value) {
                            if (angular.isString(value)) {
                                return new Date(value);
                            }
                            return null;
                        });
                        modelCtrl.$parsers.push(function (value) {
                            if (value) {
                                return value.toISOString();
                            }
                            return null;
                        });
                    }
                }
            };
            return directive;
        }]);
}());