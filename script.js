// ==UserScript==
// @name         Zeiten
// @namespace    http://tampermonkey.net/
// @version      0.4b
// @description  IMPROVE ZEPRA!
// @author       dzr
// @editor       jsk, mlr
// @match        http://general:1337/listview/Entry
// @match        http://zeiterfassung/listview/Entry
// @grant        none
// ==/UserScript==
/* jshint -W097 */
'use strict';

// that code is so dirty...

var interval;
var refreshInterval;

var PAUSE_DAY_HOURS_SIX = 0;
var PAUSE_DAY_HOURS_EIGHT = 0.5;
var PAUSE_DAY_HOURS_MAX = 0.75;
var BASE_DATE = moment.utc("1970-01-01");
var NINE_HOURS_PAUSE_ALERT_DATE = BASE_DATE.clone().hours(8).minutes(45);
var NINE_HOURS_DATE = BASE_DATE.clone().hours(9);

$(function () {
    $("#timeclocktable").data("kendoGrid").bind("dataBound", function () {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }

        refreshInterval = setInterval(function () {
            RefreshData();
            GetFilter(null, "ReloadFilter");
            actionFunc();
        }, 5 * 60 * 1000);//alle 5 min

        if (interval) {
            clearInterval(interval);
            interval = null;
        }
        interval = setInterval(actionFunc, 10000); //alle 10 sek

        var footer = $("#timeclocktable .k-footer-template");
        var tdCol1 = footer.find("td:first");
        var tdCol2 = footer.find("td:eq(1)");
        var tdCol3 = footer.find("td:last");
        var graphHeadSum = $('#GraphArea .g-title-day');

        actionFunc();

        function actionFunc() {
            /*  if($("#timeclocktable .k-footer-template").find("td").length === 3){
             $("#timeclocktable .k-footer-template").find("td").first().remove();
             $("#timeclocktable .k-footer-template").find("td").first().attr("colspan", "2");
             }*/
            if ($("#GraphArea").width() < 400) {
                $("#content").data("kendoSplitter").size("#GraphArea", "400px");
            }
            var sumText = tdCol3.text();
            var curSum = parseFloat(sumText.split(" ")[1]);
            var curSumDuration = moment.duration(curSum);

            if ($("#timeclocktable .k-grid-content tr:last td:last-child").text() === "null") {
                var lastEntryStart = moment("1970-01-01 " + $("#timeclocktable .k-grid-content tr:last td:first").text());
                var now = moment().year(1970).month(0).date(1);
                var dur = moment.duration(now.diff(lastEntryStart));
                curSumDuration.add(dur);

                // old
                var diffSeconds = dur.asSeconds();
                curSum = curSum + (diffSeconds / 60 / 60);
            }
            var curSumDate = BASE_DATE.clone().add(curSumDuration);


            var remainingSum = 8 - curSum;
            var isPositive = remainingSum < 0;
            remainingSum = Math.abs(remainingSum);

            //calc pause
            var curPauseMs = 0;
            $("#timeclocktable .k-grid-content tr").each(function () {
                var inc = $(this).find("td:eq(1)").text();
                var nextTr = $(this).next("tr");

                if (nextTr.length <= 0)
                    return false;

                var out = $(this).next("tr").find("td:first").text();
                if (inc !== "null" && out !== "null") {
                    curPauseMs += new Date("01.01.2016 " + out).getTime() - new Date("01.01.2016 " + inc).getTime();
                }
            });

            var current = BASE_DATE.clone().seconds(curSum * 60 * 60);

            var requiredPauseHours = PAUSE_DAY_HOURS_SIX;
            if (curSum > 6 && curSum <= 8)
                requiredPauseHours = PAUSE_DAY_HOURS_EIGHT;
            else if (curSum > 8) {
                requiredPauseHours = PAUSE_DAY_HOURS_MAX
            }

            var pauseHours = curPauseMs / 1000 / 60 / 60;

            var remainingPauseHours = requiredPauseHours - pauseHours;
            var maxPauseReached = false;
            var remPauseStr;

            if (remainingPauseHours < 0) {
                maxPauseReached = true;
                remainingPauseHours = Math.abs(remainingPauseHours);
                var remPauseHours = Math.floor(pauseHours);
                var remPauseMinutes = Math.ceil((pauseHours - remPauseHours) * 60);
                remPauseStr = "Pause Insg.: ";
            } else {
                var remPauseHours = Math.floor(remainingPauseHours);
                var remPauseMinutes = Math.ceil((remainingPauseHours - remPauseHours) * 60);
                remPauseStr = "Pause Verb.: ";
            }

            if (remPauseMinutes === 60) {
                remPauseMinutes = 0;
                remPauseHours++;
            }

            remPauseMinutes = "" + remPauseMinutes;
            remPauseMinutes = remPauseMinutes.length === 1 ? "0" + remPauseMinutes : remPauseMinutes;

            remPauseStr += remPauseHours + "h" + remPauseMinutes + "m";

            tdCol2.text(remPauseStr);

            //remaining time
            if (!maxPauseReached) {
                if (isPositive) {
                    remainingSum -= remainingPauseHours;
                } else {
                    remainingSum += remainingPauseHours;
                }
            }

            var remainingHours = Math.floor(remainingSum);
            var remainingMinutes = Math.ceil((remainingSum - remainingHours) * 60);
            if (remainingMinutes === 60) {
                remainingMinutes = 0;
                remainingHours++;
            }
            remainingMinutes = "" + remainingMinutes;
            remainingMinutes = remainingMinutes.length === 1 ? "0" + remainingMinutes : remainingMinutes;

            var remainingStr = (isPositive ? "Über.: " : "Verbl.: ") + remainingHours + "h" + remainingMinutes + "m";

            tdCol1.text(remainingStr);

            if (!isPositive) {
                var stayTill = new Date();
                stayTill = new Date(stayTill.getTime() + remainingSum * 60 * 60 * 1000);

                if ($(".k-grid-footer:last-child > .staytill").length == 0) {
                    $(".k-grid-footer:last-child").prepend("<div class='staytill'></div>");
                }

                var stayTillMinutes = stayTill.getMinutes();
                stayTillMinutes = stayTillMinutes.length === 1 ? "0" + stayTillMinutes : stayTillMinutes;
                $(".k-grid-footer:last-child > .staytill").html("<b>Bleiben bis mindestens: " + stayTill.getHours() + ":" + stayTillMinutes + "</b>");
            } else {
                if ($(".k-grid-footer:last-child > .staytill").length != 0) {
                    $(".k-grid-footer:last-child > .staytill").remove();
                }
            }

            // Set current sum in header
            if (current.isAfter(BASE_DATE)) {
                graphHeadSum.text("Anwesenheit - Summe: " + current.format("HH:mm") + "h");
            }

            // go home alert
            if (current.isAfter(NINE_HOURS_PAUSE_ALERT_DATE) && current.isBefore(NINE_HOURS_DATE) && !maxPauseReached) {
                var leftMins = NINE_HOURS_PAUSE_ALERT_DATE.diff(current, 'minutes');
                alert("Alter in " + leftMins + " Minuten brauchst du 45 Minuten Pause, sieh zu, dass du Land gewinnst!");
            }
        }
    });
});