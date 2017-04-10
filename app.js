var request = require('request');
var _ = require('lodash');
var async = require('async');
var moment = require('moment');
var schedule = require('node-schedule');

var config = require('./config');

// 主程序
var app = function () {
  var req = request.defaults({jar: true});

  var data = {
    shouzhangTotal: {
      dayNewlyCount: 0,
      dayEndlyCount: 0,
      allCount: 0,
      allEndlyCount: 0,
      androidUninstall: 0
    },
    iOS: {
      install_all_yesterday: 0,
      install_yesterday: 0,
      active_yesterday: 0,
      retention_rate_1: 0,
      retention_rate_3: 0,
      retention_rate_7: 0,
      retention_rate_30: 0,
      timeLength_second_1_3: 0,
      timeLength_second_4_10: 0,
      timeLength_second_11_30: 0,
      timeLength_second_31_60: 0,
      timeLength_minute_1_3: 0,
      timeLength_minute_3_10: 0,
      timeLength_minute_10_30: 0,
      timeLength_minute_30up: 0,
      errorAffectRate: 0,
      allVersionRank5: 0,
      allVersionRank4: 0,
      allVersionRank3: 0,
      allVersionRank2: 0,
      allVersionRank1: 0
    },
    Android: {
      install_all_yesterday: 0,
      install_yesterday: 0,
      active_yesterday: 0,
      retention_rate_1: 0,
      retention_rate_3: 0,
      retention_rate_7: 0,
      retention_rate_30: 0,
      timeLength_second_1_3: 0,
      timeLength_second_4_10: 0,
      timeLength_second_11_30: 0,
      timeLength_second_31_60: 0,
      timeLength_minute_1_3: 0,
      timeLength_minute_3_10: 0,
      timeLength_minute_10_30: 0,
      timeLength_minute_30up: 0,
      errorAffectRate: 0
    }
  };

  async.auto({
    // 获取友盟 token
    uToken: function (callback) {
      req.get('https://i.umeng.com', function (err, res, body) {
        if (err) return callback(err);
        
        var regex = body.match(/token: '(.+?)'/);

        if (regex&&regex[1]) {
          callback(null, regex[1]);
        } else {
          callback('没有找到 token');
        }
      });
    },
    // 登陆友盟
    uLogin: ['uToken', function (results, callback) {
      req.post('https://i.umeng.com/login/ajax_do', {
        form: {
          token: results.uToken,
          username: config.umeng.username,
          password: config.umeng.password,
          website: 'umengplus'
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Referer': 'https://i.umeng.com/',
          'Accept': '*/*',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_3) AppleWebKit/602.4.8 (KHTML, like Gecko) Version/10.0.3 Safari/602.4.8',
          'Origin': 'https://i.umeng.com',
          'X-Requested-With': 'XMLHttpRequest'
        }
      }, function (err, res, body) {
        if (err) return callback(err);

        if (JSON.parse(body).ret === 200) {
          callback(null, null);
        } else {
          callback('友盟登陆错误')
        }
      });
    }],
    // 登陆手帐后台
    moriLogin: function (callback) {
      req.post(config.mori.url + '/v1/login', {
        form: {
          username: config.mori.username,
          password: config.mori.password
        }
      }, function (err, res, body) {
        if (err) return callback(err);

        var loginData;

        try {
          loginData = JSON.parse(body);
        } catch (error) {
          return callback({message: '登陆手帐后台数据解析错误', error: error});
        }

        if (loginData.code === 200) {
          callback(null, null);
        } else {
          callback('手帐后台登陆错误')
        }
      });
    },
    // 获取友盟基本数据
    uData: ['uLogin', function (results, callback) {
      req.get('http://mobile.umeng.com/apps/get_apps_stats_details?page=1&per_page=30&type=all-apps-list&show_all=false&sort_metric=&order=', function (err, res, body) {
        if (err) return callback(err);

        var totalData;

        try {
          totalData = JSON.parse(body);
        } catch (error) {
          return callback({message: '获取友盟基本数据解析错误', error: error});
        }

        if (totalData.result !== 'success') return callback('获取友盟基本数据错误');

        var iOSData = _.find(totalData.stats, { app_id: config.umeng.iosAppId });
        var AndroidData = _.find(totalData.stats, { app_id: config.umeng.androidAppId });

        data.iOS.install_all_yesterday = iOSData.install_all - iOSData.install_today;
        data.iOS.install_yesterday = iOSData.install_yesterday;
        data.iOS.active_yesterday = iOSData.active_yesterday;
        data.Android.install_all_yesterday = AndroidData.install_all - AndroidData.install_today;
        data.Android.install_yesterday = AndroidData.install_yesterday;
        data.Android.active_yesterday = AndroidData.active_yesterday;

        callback();
      });
    }],
    // 获取友盟Android卸载数据
     uAndroidUninstall: ['uLogin', function (results, callback) {
      return callback();
      req.post('http://push.umeng.com/uninstall/now', {
        form: {
          appkey: config.umeng.androidAppKey
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Referer': 'http://push.umeng.com/' + config.umeng.androidAppKey + '/uninstall',
          'Accept': '*/*',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_3) AppleWebKit/602.4.8 (KHTML, like Gecko) Version/10.0.3 Safari/602.4.8',
          'Origin': 'http://push.umeng.com',
          'X-Requested-With': 'XMLHttpRequest'
        } 
      }, function (err, res, body) {
        if (err) return callback(err);

        var totalData;

        try {
          totalData = JSON.parse(body);
        } catch (error) {
          return callback({message: '获取友盟Android卸载数据解析错误', error: error});
        }

        if (totalData.success !== 1) return callback('获取友盟Android卸载数据错误');

        data.shouzhangTotal.androidUninstall = totalData.yesterday_uninstall_count;

        callback();
      });
    }],
    // 获取手帐后台基本数据
    moriData: ['moriLogin', function (results, callback) {
      req.get(config.mori.url + '/v1/daily', function (err, res, body) {
        if (err) return callback(err);

        try {
          var totalData = JSON.parse(body);
        } catch (error) {
          return callback({message: '获取手帐后台基本数据解析错误', error: error});
        }
        
        if (totalData.code !== 200) return callback('获取手帐基本数据错误');

        data.shouzhangTotal.dayNewlyCount = totalData.data.dayNewlyCount;
        data.shouzhangTotal.dayEndlyCount = totalData.data.dayEndlyCount;
        data.shouzhangTotal.allCount = totalData.data.allCount;
        data.shouzhangTotal.allEndlyCount = totalData.data.allEndlyCount;

        callback();
      });
    }],
    // 获取 iOS 留存率数据
    iOSRetention: ['uLogin', function (results, callback) {
      var today = moment().format('YYYY-MM-DD');
      var daysAgo31 = moment().subtract(31, 'days').format('YYYY-MM-DD');

      var url = 'http://mobile.umeng.com/apps/' + config.umeng.iosAppId + '/reports/load_table_data?page=1&per_page=1000&start_date=' + daysAgo31 +'&end_date=' + today + '&versions%5B%5D=&channels%5B%5D=&segments%5B%5D=&time_unit=daily&stats=retentions';
      
      req.get(url, function (err, res, body) {
        if (err) return callback(err);

        var totalData;

        try {
          totalData = JSON.parse(body);
        } catch (error) {
          return callback({message: '获取 iOS 留存率数据解析错误', error: error});
        }

        if (totalData.result !== 'success') return callback('获取 iOS 留存数据错误');

        data.iOS.retention_rate_1 = _.find(totalData.stats, { install_period: moment().subtract(2, 'days').format('YYYY-MM-DD') }).retention_rate[0];
        data.iOS.retention_rate_3 = _.find(totalData.stats, { install_period: moment().subtract(4, 'days').format('YYYY-MM-DD') }).retention_rate[2];
        data.iOS.retention_rate_7 = _.find(totalData.stats, { install_period: moment().subtract(8, 'days').format('YYYY-MM-DD') }).retention_rate[6];
        data.iOS.retention_rate_30 = _.find(totalData.stats, { install_period: moment().subtract(31, 'days').format('YYYY-MM-DD') }).retention_rate[8];

        callback();
      });
    }],
    // 获取 Android 留存率数据
    AndroidRetention: ['uLogin', function (results, callback) {
      var today = moment().format('YYYY-MM-DD');
      var daysAgo31 = moment().subtract(31, 'days').format('YYYY-MM-DD');

      var url = 'http://mobile.umeng.com/apps/' + config.umeng.androidAppId + '/reports/load_table_data?page=1&per_page=1000&start_date=' + daysAgo31 +'&end_date=' + today + '&versions%5B%5D=&channels%5B%5D=&segments%5B%5D=&time_unit=daily&stats=retentions';
      
      req.get(url, function (err, res, body) {
        if (err) return callback(err);

        var totalData;

        try {
          totalData = JSON.parse(body);
        } catch (error) {
          return callback({message: '获取 Android 留存率数据解析错误', error: error});
        }

        if (totalData.result !== 'success') return callback('获取 Android 留存数据错误');

        data.Android.retention_rate_1 = _.find(totalData.stats, { install_period: moment().subtract(2, 'days').format('YYYY-MM-DD') }).retention_rate[0];
        data.Android.retention_rate_3 = _.find(totalData.stats, { install_period: moment().subtract(4, 'days').format('YYYY-MM-DD') }).retention_rate[2];
        data.Android.retention_rate_7 = _.find(totalData.stats, { install_period: moment().subtract(8, 'days').format('YYYY-MM-DD') }).retention_rate[6];
        data.Android.retention_rate_30 = _.find(totalData.stats, { install_period: moment().subtract(31, 'days').format('YYYY-MM-DD') }).retention_rate[8];

        callback();
      });
    }],
    // 获取 iOS 日使用数据
    iOSTimeLength: ['uLogin', function (results, callback) {
      var today = moment().format('YYYY-MM-DD');

      var url = 'http://mobile.umeng.com/apps/' + config.umeng.iosAppId + '/reports/load_chart_data?start_date=' + moment().subtract(1, 'days').format('YYYY-MM-DD') + '&end_date=' + moment().subtract(1, 'days').format('YYYY-MM-DD') + '&versions%5B%5D=&channels%5B%5D=&segments%5B%5D=&time_unit=daily&stats=duration&stat_type=daily';
      
      req.get(url, function (err, res, body) {
        if (err) return callback(err);

        var totalData;

        try {
          totalData = JSON.parse(body);
        } catch (error) {
          return callback({message: '获取 iOS 日使用数据解析错误', error: error});
        }

        if (totalData.result !== 'success') return callback('获取 iOS 日使用数据错误');
   
        var timeLength = _.find(totalData.stats, { name: moment().subtract(1, 'days').format('MM-DD') }).data;

        data.iOS.timeLength_second_1_3 = timeLength[0];
        data.iOS.timeLength_second_4_10 = timeLength[1];
        data.iOS.timeLength_second_11_30 = timeLength[2];
        data.iOS.timeLength_second_31_60 = timeLength[3];
        data.iOS.timeLength_minute_1_3 = timeLength[4];
        data.iOS.timeLength_minute_3_10 = timeLength[5];
        data.iOS.timeLength_minute_10_30 = timeLength[6];
        data.iOS.timeLength_minute_30up = timeLength[7];

        callback();
      });
    }],
    // 获取 Android 日使用数据
    AndroidTimeLength: ['uLogin', function (results, callback) {
      var today = moment().format('YYYY-MM-DD');

      var url = 'http://mobile.umeng.com/apps/' + config.umeng.androidAppId + '/reports/load_chart_data?start_date=' + moment().subtract(1, 'days').format('YYYY-MM-DD') + '&end_date=' + moment().subtract(1, 'days').format('YYYY-MM-DD') + '&versions%5B%5D=&channels%5B%5D=&segments%5B%5D=&time_unit=daily&stats=duration&stat_type=daily';
      
      req.get(url, function (err, res, body) {
        if (err) return callback(err);

        var totalData;

        try {
          totalData = JSON.parse(body);
        } catch (error) {
          return callback({message: '获取 Android 日使用数据解析错误', error: error});
        }

        if (totalData.result !== 'success') return callback('获取 Android 日使用数据错误');

        var timeLength = _.find(totalData.stats, { name: moment().subtract(1, 'days').format('MM-DD') }).data;

        data.Android.timeLength_second_1_3 = timeLength[0];
        data.Android.timeLength_second_4_10 = timeLength[1];
        data.Android.timeLength_second_11_30 = timeLength[2];
        data.Android.timeLength_second_31_60 = timeLength[3];
        data.Android.timeLength_minute_1_3 = timeLength[4];
        data.Android.timeLength_minute_3_10 = timeLength[5];
        data.Android.timeLength_minute_10_30 = timeLength[6];
        data.Android.timeLength_minute_30up = timeLength[7];

        callback();
      });
    }],
    // 获取 iOS 错误影响用户/活跃用户数
    iOSErrorAffectRate: ['uLogin', function (results, callback) {
      var today = moment().format('YYYY-MM-DD');

      var url = 'http://mobile.umeng.com/apps/' + config.umeng.iosAppId + '/reports/load_chart_data?start_date=' + moment().subtract(1, 'days').format('YYYY-MM-DD') + '&end_date=' + moment().subtract(1, 'days').format('YYYY-MM-DD') + '&stats=error_affect_rate'
      
      req.get(url, function (err, res, body) {
        if (err) return callback(err);

        var totalData;

        try {
          totalData = JSON.parse(body);
        } catch (error) {
          return callback({message: '获取 iOS 错误影响用户/活跃用户数解析错误', error: error});
        }

        if (totalData.result !== 'success') return callback('获取 iOS 错误影响用户/活跃用户数错误');

        data.iOS.errorAffectRate = _.get(totalData, 'stats[0].data[0]');

        callback();
      });
    }],
    // 获取 Android 错误影响用户/活跃用户数
    AndroidErrorAffectRate: ['uLogin', function (results, callback) {
      var today = moment().format('YYYY-MM-DD');

      var url = 'http://mobile.umeng.com/apps/' + config.umeng.androidAppId + '/reports/load_chart_data?start_date=' + moment().subtract(1, 'days').format('YYYY-MM-DD') + '&end_date=' + moment().subtract(1, 'days').format('YYYY-MM-DD') + '&stats=error_affect_rate'
      
      req.get(url, function (err, res, body) {
        if (err) return callback(err);

        var totalData;

        try {
          totalData = JSON.parse(body);
        } catch (error) {
          return callback({message: '获取 Android 错误影响用户/活跃用户数据解析错误', error: error});
        }

        if (totalData.result !== 'success') return callback('获取 Android 错误影响用户/活跃用户数错误');

        data.Android.errorAffectRate = _.get(totalData, 'stats[0].data[0]');

        callback();
      });
    }],
    // 获取 iOS Mori 评分数据
    iosMoriCommentStat: function (callback) {
      req.get('http://rest.appbk.com/app_comment/get_app_comment_stat?app_id=' + config.itunes.appId, function (err, res, body) {
        if (err) return callback(err);

        var totalData = JSON.parse(body);

        data.iOS.allVersionRank5 = Number(totalData.all_version[5].num);
        data.iOS.allVersionRank4 = Number(totalData.all_version[4].num);
        data.iOS.allVersionRank3 = Number(totalData.all_version[3].num);
        data.iOS.allVersionRank2 = Number(totalData.all_version[2].num);
        data.iOS.allVersionRank1 = Number(totalData.all_version[1].num);

        callback();
      });
    }
  }, function (err, results) {
    if (err) {
      // 重试程序
      setTimeout(app, 3000);
      return console.log(JSON.stringify(err));
    }

    // 向钉钉发送消息
    req.post('https://oapi.dingtalk.com/robot/send?access_token=' + config.dingtalk.token, {
      body: '{"msgtype": "markdown","markdown": {' +
              '"title":"Mori手帐数据日报",' +
              '"text":"' +
                '**Mori手帐数据日报**\n\n' +
                '汇报日期：' + moment().format('YYYY-MM-DD') + '\n\n' +
                '数据日期：' + moment().subtract(1, 'days').format('YYYY-MM-DD') + '\n\n' +
                '累计用户数：' + (data.iOS.install_all_yesterday + data.Android.install_all_yesterday) + '\n\n' +
                '累计手帐数：' + data.shouzhangTotal.allCount + '\n\n' +
                '新增用户数：' + (data.iOS.install_yesterday + data.Android.install_yesterday) + '\n\n' +
                'Android卸载数：' + data.shouzhangTotal.androidUninstall + '\n\n' +
                '活跃用户数：' + (data.iOS.active_yesterday + data.Android.active_yesterday) + '\n\n' +
                '新增手帐数：' + data.shouzhangTotal.dayNewlyCount + '\n\n' +
                '次日留存率均值：' + Math.floor((data.iOS.retention_rate_1 + data.Android.retention_rate_1) / 2 * 100) / 100 + '%\n\n' +
                '3日留存率均值：' + Math.floor((data.iOS.retention_rate_3 + data.Android.retention_rate_3) / 2 * 100) / 100 + '%\n\n' +
                '7日留存率均值：' + Math.floor((data.iOS.retention_rate_7 + data.Android.retention_rate_7) / 2 * 100) / 100 + '%\n\n' +
                '30日留存率均值：' + Math.floor((data.iOS.retention_rate_30 + data.Android.retention_rate_30) / 2 * 100) / 100 + '%\n\n' +
                '0~3分钟使用时长均值：' + Math.floor((data.iOS.timeLength_second_1_3 + data.iOS.timeLength_second_4_10 + data.iOS.timeLength_second_11_30 + data.iOS.timeLength_second_31_60 + data.iOS.timeLength_minute_1_3 + data.Android.timeLength_second_1_3 + data.Android.timeLength_second_4_10 + data.Android.timeLength_second_11_30 + data.Android.timeLength_second_31_60 + data.Android.timeLength_minute_1_3) / 2 * 100) / 100 + '%\n\n' +
                '3~10分钟使用时长均值：' + Math.floor((data.iOS.timeLength_minute_3_10 + data.Android.timeLength_minute_3_10) / 2 * 100) / 100 + '%\n\n' +
                '10分钟以上使用时长均值：' + Math.floor((data.iOS.timeLength_minute_10_30 + data.iOS.timeLength_minute_30up + data.Android.timeLength_minute_10_30 + data.Android.timeLength_minute_30up) / 2 * 100) / 100 + '%\n\n' +
                'iOS错误影响用户/活跃用户：' + Math.floor(data.iOS.errorAffectRate * 10000) / 10000 + '\n\n' +
                'Android错误影响用户/活跃用户：' + Math.floor(data.Android.errorAffectRate * 10000) / 10000 + '\n\n' +
                '净推荐值：' + Math.floor((data.iOS.allVersionRank5 / (data.iOS.allVersionRank5 + data.iOS.allVersionRank4 + data.iOS.allVersionRank3 + data.iOS.allVersionRank2 + data.iOS.allVersionRank1) - (data.iOS.allVersionRank3 + data.iOS.allVersionRank2 + data.iOS.allVersionRank1) / (data.iOS.allVersionRank5 + data.iOS.allVersionRank4 + data.iOS.allVersionRank3 + data.iOS.allVersionRank2 + data.iOS.allVersionRank1)) * 10000) / 100 + '%\n\n' +
            '"}}',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    }, function (err, res, body) {
      if (err) return console.log(JSON.stringify(err));

      if (JSON.parse(body).errcode !== 0) {
        return console.log('发送钉钉消息错误');
      } else {
        console.log('任务已执行完毕！');
      }
    });
  });
};

// JOB任务
if (!config.test) {
  schedule.scheduleJob(config.job.time, app);
} else {
  app();
}