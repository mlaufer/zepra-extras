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
var BASE_DATE_SIX = BASE_DATE.clone().hours(6)
var BASE_DATE_EIGHT = BASE_DATE.clone().hours(8);
var NINE_HOURS_PAUSE_ALERT_DATE = BASE_DATE_EIGHT.clone().minutes(45);
var NINE_HOURS_DATE = BASE_DATE.clone().hours(9);

var NOTIFICATION_ALLOWED = false;

var $notification = null;

if (("Notification" in window)) {
    NOTIFICATION_ALLOWED = Notification.permission === "granted";

    if (Notification.permission === "default") {
        Notification.requestPermission().then(function(result) {
            if (result === 'granted') {
                NOTIFICATION_ALLOWED = true;
                return;
            }
        });
    }

}


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
            var curSumDuration = moment.duration({hour: curSum});
            var now = moment();

            if ($("#timeclocktable .k-grid-content tr:last td:last-child").text() === "null") {
                var lastEntryStart = moment("1970-01-01 " + $("#timeclocktable .k-grid-content tr:last td:first").text());
                var nowTime = moment().year(1970).month(0).date(1);
                var dur = moment.duration(nowTime.diff(lastEntryStart));
                curSumDuration = curSumDuration.add(dur);

                // old
                var diffSeconds = dur.asSeconds();
                curSum = curSum + (diffSeconds / 60 / 60);
            }

            var current = BASE_DATE.clone().add(curSumDuration);

            var remainingSum = 8 - curSum;
            remainingSum = Math.abs(remainingSum);
            var isPositive = current.isAfter(BASE_DATE_EIGHT);

            //calc pause
            var curPauseMoment = moment.duration(0);
            $("#timeclocktable .k-grid-content tr").each(function () {
                var inc = $(this).find("td:eq(1)").text();
                var nextTr = $(this).next("tr");

                if (nextTr.length <= 0)
                    return false;

                var out = nextTr.find("td:first").text();
                if (inc !== "null" && out !== "null") {
                    var pauseDiff = moment.duration(out).subtract(moment.duration(inc));
                    curPauseMoment.add(pauseDiff);
                }
            });

            var requiredPauseHours = PAUSE_DAY_HOURS_EIGHT;
            if (current.isBefore(BASE_DATE_SIX) && now.isoWeekday() == 5) {
                requiredPauseHours = PAUSE_DAY_HOURS_SIX;
            }
            else if (current.isAfter(BASE_DATE_EIGHT)) {
                requiredPauseHours = PAUSE_DAY_HOURS_MAX
            }
            var requiredPauseMoment = moment.duration({hour: requiredPauseHours});

            var pauseHours = curPauseMoment.asHours();
            var remainingPauseHours = requiredPauseHours - pauseHours;
            var remainingPauseMoment = requiredPauseMoment.subtract(curPauseMoment);

            var pauseDiff = requiredPauseMoment.valueOf() - curPauseMoment.valueOf()
            var maxPauseReached = false;
            var remPauseStr;

            if (remainingPauseMoment.valueOf() < 0) {
                maxPauseReached = true;
                remPauseStr = "Pause Insg.: " + BASE_DATE.clone().add(curPauseMoment).format("HH:mm")  + "h";
            } else {
                remPauseStr = "Pause Verb.: " + BASE_DATE.clone().add(remainingPauseMoment).format("HH:mm") + "h";
            }

            tdCol2.text(remPauseStr);

            //remaining time
            if (!maxPauseReached) {
                current = current.subtract(remainingPauseMoment);
            }

            var remaining = BASE_DATE_EIGHT.clone().subtract(current);

           /* if (!maxPauseReached) {
                remaining = remaining.add(remainingPauseMoment);
            }*/

            if (isPositive) {
                var remainingStr = "Über.: " + (current.clone().subtract(moment.duration({hour: 8}))).format("HH:mm") + "h";
            } else {
                var remainingStr = "Verbl.: " + remaining.format("HH:mm") + "h";
            }

            tdCol1.text(remainingStr);

            if (!isPositive) {
                var nowTime = moment().year(1970).month(0).date(1);
                nowTime = nowTime.add(remaining);

                if ($(".k-grid-footer:last-child > .staytill").length == 0) {
                    $(".k-grid-footer:last-child").prepend("<div class='staytill'></div>");
                }

                $(".k-grid-footer:last-child > .staytill").html("<b>Bleiben bis mindestens: " + nowTime.format("HH:mm") + "h</b>");
            } else {
                if ($(".k-grid-footer:last-child > .staytill").length != 0) {
                    $(".k-grid-footer:last-child > .staytill").remove();
                }
            }

            // Set current sum in header
            if (current.isAfter(BASE_DATE)) {
                var txt = "Anwesenheit - Summe: " + current.format("HH:mm") + "h (" + BASE_DATE.clone().add(curPauseMoment).format("HH:mm") + "h)";

                graphHeadSum.text(txt);
            }

            // go home alert
            if (current.isAfter(NINE_HOURS_PAUSE_ALERT_DATE) && current.isBefore(NINE_HOURS_DATE) && !maxPauseReached) {
                var leftMins = 15 - current.diff(NINE_HOURS_PAUSE_ALERT_DATE, 'minutes');
                var text = "In " + leftMins + " Minuten brauchst du 45 Minuten Pause, geh heim!";
                if (!NOTIFICATION_ALLOWED)
                    alert(text);
                else {
                    if ($notification == null) {
                        $notification = new Notification(text);
                        $notification.onclose = function() {
                            $notification = null;
                        };
                    }
                }
            }
        }
    });
});