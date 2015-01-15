import tornado.ioloop
import tornado.web as web
import tornado.escape
import tornado.template
import tornado.httputil
import tornado.httpclient
import tornado.auth
import httplib
import tornado.options

import json
import urllib

import uuid
import base64
import hashlib

import datetime
import time
import email.utils
import os

import re

import gzip
import cStringIO

import model

tornado.options.define("port", default=8112, help="the port number to run on", type=int)

import config

def random256() :
    return base64.b64encode(uuid.uuid4().bytes + uuid.uuid4().bytes)

try :
    cookie_secret = config.cookie_secret
except :
    cookie_secret = None
if not cookie_secret :
    cookie_secret = random256()


model.db_connect("tm.db")
model.User.ensure('kmill31415@gmail.com')

class TRequestHandler(web.RequestHandler) :
    def get_current_user(self) :
        return model.User.with_email(self.get_secure_cookie("user_email"))

class GoogleHandler(TRequestHandler) :
    @tornado.web.asynchronous
    def get(self):
        if self.get_argument("state", None) == self.get_secure_cookie("oauth_state") != None :
            self._on_auth()
            return
        state = json.dumps({"code" : random256(),
                            "redirect" : self.get_argument("next", "/")})
        self.set_secure_cookie("oauth_state", state)
        args = {
            "response_type" : "code",
            "client_id" : config.client_id,
            "redirect_uri" : config.login_url,
            "scope" : "openid email",
            "access_type" : "online",
            "approval_prompt" : "auto",
            "state" : state
            }
        url = "https://accounts.google.com/o/oauth2/auth"
        self.redirect(url + "?" + urllib.urlencode(args))

    def _on_auth(self) :
        if self.get_argument("error", None) :
            raise tornado.web.HTTPError(500, self.get_argument("error"))
        code = self.get_argument("code")

        args = {
            "code" : code,
            "client_id" : config.client_id,
            "client_secret" : config.client_secret,
            "redirect_uri" : config.login_url,
            "grant_type" : "authorization_code"
            }

        tornado.httpclient.AsyncHTTPClient().fetch("https://accounts.google.com/o/oauth2/token", self._on_token, method="POST", body=urllib.urlencode(args))
    def _on_token(self, response) :
        if response.error :
            raise tornado.web.HTTPError(500, "Getting tokens failed")
        data = json.loads(response.body)
        self.access_data = data
        print "data", data

        headers = tornado.httputil.HTTPHeaders({
                "Authorization" : "Bearer " + data['access_token']
                })
        tornado.httpclient.AsyncHTTPClient().fetch("https://www.googleapis.com/userinfo/v2/me", headers=headers, callback=self.on_userinfo)
    def on_userinfo(self, response) :
        if response.error :
            raise tornado.web.HTTPError(500, "Getting user info failed")
        data = json.loads(response.body)

        email = data["email"]
        access_token = self.access_data["access_token"]
        expires = datetime.datetime.utcnow() + datetime.timedelta(seconds=int(self.access_data["expires_in"]))
        refresh_token = self.access_data.get("refresh_token", None)

#        u = model.User.ensure(email)
        u = model.User.with_email(email)

        self.set_secure_cookie("user_email", u.email)

        state = json.loads(self.get_secure_cookie("oauth_state"))
        self.clear_cookie("oauth_state")
        self.redirect(state['redirect'])

class MainHandler(TRequestHandler) :
    @tornado.web.authenticated
    def get(self) :
        self.xsrf_token # to generate token
        self.render("tasks.html")

class IndexHandler(TRequestHandler) :
    def get(self) :
        if self.current_user :
            self.redirect("/tasks", permanent=False)
        else :
            self.render("index.html")

class SignoutHandler(TRequestHandler) :
    def get(self) :
        self.clear_cookie("user_email")
        self.redirect("/", permanent=False)

class AjaxHandler(TRequestHandler) :
    @tornado.web.asynchronous
    def post(self, request) :
        arguments = json.loads(self.get_argument("arguments"))
        if self.current_user == None :
            self.finish({
                    "response" : "signin"
                    })
        elif request == "tasks" :
            since = arguments.get("since", -1)
            tasks = model.Task.tasks_since(self.current_user, since)
            task_string = json.dumps({"response" : "ok",
                                      "next_since" : max(t.version for t in tasks) if tasks else since,
                                      "tasks" : [t.content for t in tasks]})

            self.set_header("Content-Type", "application/json; charset=UTF-8")
            responseBytes = tornado.escape.utf8(task_string)
            if "gzip" in self.request.headers.get("Accept-Encoding", "") :
                self.set_header("Content-Encoding", "gzip")
                cs = cStringIO.StringIO()
                f = gzip.GzipFile(mode="w", compresslevel=9, fileobj=cs)
                f.write(responseBytes)
                f.close()
                responseBytes = cs.getvalue()
            self.write(responseBytes)
            self.finish()
        elif request == "save" :
            tasks = arguments["tasks"]
            
            for task in tasks :
                t = model.Task.with_id(self.current_user, task['id'])
                new_version = int(time.time() * 1000)
                content = json.dumps(task, separators=(',',':'))
                print task['id']
                if not t :
                    print " - new"
                    t = model.Task(self.current_user, task['id'], new_version, content)
                    t.update()
                elif t.version < task['version'] :
                    print " - updated"
                    t.version = new_version
                    t.content = content
                    t.update()
                else :
                    print " - ignored"
            self.finish({
                    "response" : "ok"
                    })
        else :
            self.finish({
                    "response" : "unknown"
                    })


class TApplication(tornado.web.Application) :
    def __init__(self) :
        settings = dict(
            app_title="Task Manager",
            template_path="templates",
            static_path="static",
            login_url="/signin",
            cookie_secret=cookie_secret,
            ui_modules={},
            xsrf_cookies=True,
            )
        
        handlers = [
            (r"/", IndexHandler),
            (r"/tasks/?", MainHandler),
            (r"/signin", GoogleHandler),
            (r"/signout", SignoutHandler),
            (r"/ajax/(.*)", AjaxHandler),
            ]
        
        tornado.web.Application.__init__(self, handlers, **settings)

if __name__=="__main__" :
    tornado.options.parse_command_line()
    print "Starting Task Manager..."
    application = TApplication()
    portnum = tornado.options.options.port
    application.listen(portnum)
    print "Listening on port %s" % portnum
    tornado.ioloop.IOLoop.instance().start()
