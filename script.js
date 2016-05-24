// ==UserScript==
// @name         Zeiten
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  IMPROVE ZEPRA!
// @author       dzr
// @match        http://general:1337/listview/Entry
// @match        http://zeiterfassung/listview/Entry
// @grant        none
// ==/UserScript==
/* jshint -W097 */
'use strict';

// that code is so dirty...

var interval;
var refreshInterval;

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
        actionFunc();

        function actionFunc() {
            /*  if($("#timeclocktable .k-footer-template").find("td").length === 3){
             $("#timeclocktable .k-footer-template").find("td").first().remove();
             $("#timeclocktable .k-footer-template").find("td").first().attr("colspan", "2");
             }*/
            if ($("#GraphArea").width() < 400) {
                $("#content").data("kendoSplitter").size("#GraphArea", "400px");
            }
            var curSum = parseFloat($("#timeclocktable .k-footer-template").find("td").last().text().split(" ")[1]);

            if ($("#timeclocktable .k-grid-content tr:last td:last-child").text() === "null") {
                var lastIncTime = new Date("01.01.2016 " + $("#timeclocktable .k-grid-content tr:last td:first").text());
                var curTime = new Date();
                curTime.setDate(1);
                curTime.setMonth(0);
                curTime.setYear(2016);
                var diffSeconds = (curTime.getTime() - lastIncTime.getTime()) / 1000;
                curSum = curSum + (diffSeconds / 60 / 60);
            }

            var remainingSum = 8 - curSum;

            var isPositive = false;
            if (remainingSum < 0) {
                isPositive = true;
            }

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
            var PAUSE_DAY_HOURS = 0.5;
            if (curSum >= 9) {
                PAUSE_DAY_HOURS = 0.75;
            }
            var pauseHours = curPauseMs / 1000 / 60 / 60;

            var remainingPauseHours = PAUSE_DAY_HOURS - pauseHours;
            var maxPauseReached = false;
            var remPauseStr;

            if (remainingPauseHours < 0) {
                maxPauseReached = true;
                remainingPauseHours = Math.abs(remainingPauseHours);
                var remPauseHours = Math.floor(pauseHours);
                var remPauseMinutes = Math.ceil((pauseHours - remPauseHours) * 60);
                if (remPauseMinutes === 60) {
                    remPauseMinutes = 0;
                    remPauseHours++;
                }
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

            $("#timeclocktable .k-footer-template").find("td:eq(1)").text(remPauseStr);

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

            // alert wenn 15 min vor 9h und noch keine 45 min pause gemacht
            if (isPositive && remainingHours === 0 && remainingMinutes === 45 && !maxPauseReached) {
                alert("Alter in 15 Minuten brauchst du 45 Minuten Pause, sieh zu, dass du Land gewinnst!");
            }

            $("#timeclocktable .k-footer-template").find("td:first").text(remainingStr);

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
        }
    });
});