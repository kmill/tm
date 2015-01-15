import os.path
import time
import sqlite3
import json

DB = None

def db_connect(dbfile) :
    """Connects to the db.  Sets the global DB variable because there should be only
    one connection to the db at a time anyway."""
    global DB
    if not os.path.isfile(dbfile) :
        raise TypeError("The database file must be created first.")
    DB = sqlite3.connect(dbfile, detect_types=sqlite3.PARSE_DECLTYPES)
    DB.executescript("""
        pragma foreign_keys = ON;
    """)
    DB.row_factory = sqlite3.Row

class User(object) :
    def __init__(self, id=None, email=None, extra_data=None) :
        self.id = id
        self.email = email
        self.extra_data = extra_data
    def update(self) :
        if self.id == None :
            with DB :
                c = DB.execute("insert into users (email, extra_data) values (?,?)",
                               (self.email,self.extra_data))
                self.id = c.lastrowid
        else :
            with DB :
                DB.execute("update users set extra_data=? where id=?",
                           (self.extra_data, self.id))
    @classmethod
    def ensure(cls, email) :
        u = cls.with_email(email)
        if u == None :
            u = User(email=email)
            u.update()
        return u
    @classmethod
    def with_email(cls, email) :
        for row in DB.execute("select id, email from users where email=?", (email,)) :
            return User(id=row['id'], email=row['email'])

class Task(object) :
    def __init__(self, owner, id, version, content) :
        self.owner = owner
        self.id = id
        self.version = version
        self.content = content
    def update(self) :
        with DB :
            DB.execute("""
              insert or replace into tasks
                (owner, id, version, content)
              values (?, ?, ?, ?)""",
                       (self.owner.id, self.id, self.version, self.content))
    @classmethod
    def tasks_since(cls, owner, version) :
        tasks = []
        for row in DB.execute("select id, version, content from tasks where owner=? and version > ?", (owner.id, version,)) :
            t = Task(owner, row['id'], row['version'], row['content'])
            tasks.append(t)
        return tasks
    @classmethod
    def with_id(cls, owner, id) :
        for row in DB.execute("select version, content from tasks where owner=? and id=?",
                              (owner.id, id)) :
            return Task(owner, id, row['version'], row['content'])
