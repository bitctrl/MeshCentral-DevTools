/** 
* @description MeshCentral DevTools Plugin
* @author Ryan Blenis
* @copyright 
* @license Apache-2.0
*/

"use strict";

module.exports.devtools = function (parent) {
    var obj = {};
    obj.parent = parent;
    obj.meshServer = parent.parent;
    obj.VIEWS = __dirname + '/views/';
    
    obj.handleAdminReq = function(req, res, user) {
        if ((user.siteadmin & 0xFFFFFFFF) == 0) { res.sendStatus(401); return; }
        var vars = {};
        res.render(obj.VIEWS + 'admin', vars);
    };
    
    obj.serveraction = function(command, myparent, grandparent) {
        switch (command.pluginaction) {
            case 'addPluginConfig':
                if (command.cfg.status == null) command.cfg.status = 1;
                obj.meshServer.db.addPlugin(command.cfg, function(){
                  obj.meshServer.db.getPlugins(function(err, docs) {
                      try { myparent.ws.send(JSON.stringify({ action: 'updatePluginList', list: docs, result: err })); } catch (ex) { } 
                  });
                });
            break;
            case 'refreshPluginHandler':
                //var mcpath = obj.meshServer.path.join(obj.meshServer.webPublicPath, '../');
                //obj.meshServer.pluginHandler = require(mcpath+'pluginHandler.js').pluginHandler(obj.meshServer);
                var targets = ['*', 'server-users'];
                obj.meshServer.DispatchEvent(targets, obj, { action: 'pluginStateChange' });
            break;
            case 'getPluginConfig':
                obj.meshServer.db.getPlugin(command.id, (err, conf) => {
                    myparent.ws.send(JSON.stringify({ action: 'plugin', plugin: "devtools", method: "loadEditPluginConfig", conf: conf, result: err }));
                });
            break;
            case 'savePluginConfig':
                obj.meshServer.db.updatePlugin(command.id, command.conf, (err, conf) => {
                    obj.meshServer.db.getPlugins(function(err, docs) {
                        try { myparent.ws.send(JSON.stringify({ action: 'updatePluginList', list: docs, result: err })); } catch (ex) { } 
                    });
                });
            break;
            case 'deletePluginConfig':
                obj.meshServer.db.deletePlugin(command.id, (err, conf) => {
                    obj.meshServer.db.getPlugins(function(err, docs) {
                        try { myparent.ws.send(JSON.stringify({ action: 'updatePluginList', list: docs, result: err })); } catch (ex) { } 
                    });
                });
            break;
            case 'disableAllPlugins': {
                obj.meshServer.db.getPlugins(function(err, docs) {
                    if (err) { console.log('PLUGIN: devtools:', err); return; }
                    let pendingUpdates = 0;
                    for (const doc of docs) {
                        if (doc.shortName === 'devtools' || doc.status === 0) { continue; }
                        ++pendingUpdates;
                        console.log('PLUGIN: devtools: disabling plugin:', doc.shortName);
                        doc._devtools_previousStatus = doc.status;
                        doc.status = 0;
                        obj.meshServer.db.updatePlugin(doc._id, doc, function() {
                            if (--pendingUpdates == 0 ) { console.log('PLUGIN: devtools:', command.pluginaction, 'DONE'); }
                        })
                    }
                });
                break;
            }
            case 'enablePreviouslyDisabledPlugins': {
                obj.meshServer.db.getPlugins(function(err, docs) {
                    if (err) { console.log('PLUGIN: devtools:', err); return; }
                    let pendingUpdates = 0;
                    for (const doc of docs) {
                        const previousStatus = (+doc._devtools_previousStatus) ?? 0;
                        if (isNaN(previousStatus) || previousStatus === 0) { continue; }
                        ++pendingUpdates;
                        console.log('PLUGIN: devtools: enabling plugin:', doc.shortName);
                        doc.status = previousStatus;
                        delete doc._devtools_previousStatus;
                        obj.meshServer.db.updatePlugin(doc._id, doc, function() {
                            if (--pendingUpdates == 0 ) { console.log('PLUGIN: devtools:', command.pluginaction, 'DONE'); }
                        })
                    }
                });
                break;
            }
            case 'restartServer':
                process.exit(123);
            default:
                console.log('PLUGIN: devtools: unknown action');
            break;
        }
    };
    
    return obj;
}