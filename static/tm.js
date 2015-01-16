// tm.js

'use strict';

_.mixin({
  im : function (o, selector) {
    var pre_arguments = _.rest(arguments, 2);
    return function () {
      var method = typeof selector == "function" ? selector : o[selector];
      if (method === void 0) {
        throw new TypeError("Object " + o + " has no method '" + selector + "'");
      } else {
        return method.apply(o, pre_arguments.concat(_.toArray(arguments)));
      }
    };
  }
});

function Request(command, data) {
  return new Future(function (callback, error) {
    $.ajax({
      url : "/ajax/" + command,
      type : "POST",
      dataType : "json",
      cache : false,
      timeout: 30000,
      data : { _xsrf : getCookie("_xsrf"),
               arguments : JSON.stringify(data) },
      success : function (d) {
        if (d.response == "ok") {
          callback(d);
        } else if (d.response) {
          error(d.response);
        } else {
          error("bad request");
        }
      },
      error : function (jqXHR, textStatus, message) {
        error("connection", textStatus, message);
      }
    });
  });
}


/// other stuff

function getCookie(name) {
  var r = document.cookie.match("\\b" + name + "=([^;]*)\\b");
  return r ? r[1] : undefined;
}

var months = {
  0 : "Jan", 1 : "Feb", 2 : "Mar", 3 : "Apr", 4 : "May", 5 : "Jun",
  6 : "Jul", 7 : "Aug", 8 : "Sep", 9 : "Oct", 10 : "Nov", 11 : "Dec"
};
var days = {
  0 : "Sun", 1 : "Mon", 2 : "Tue", 3 : "Wed", 4 : "Thu", 5 : "Fri", 6 : "Sat"
};

// Converts a date object into a short time string
function shortTime(date, showTime) {
  function pad2(n) {
    var o = "0" + n;
    return o.substring(o.length-2);
  }
  var now = new Date();
  var h = date.getHours();
  var hs = h%12 == 0 ? 12 : h%12;
  var ampm = h < 12 ? "am" : "pm";
  var time = hs + ":" + pad2(date.getMinutes()) + " " + ampm;
  var cptime = showTime ? " " + time : "";
  if (date.getFullYear()  == now.getFullYear()) {
    if (date.getMonth() == now.getMonth()
        && (date.getDate() == now.getDate()
            || (date.getDate() + 1 == now.getDate()
                && now.getHours() < 12
                && date.getHours() + date.getMinutes()/60 > 12))) {
      return time;
    } else {
      return days[date.getDay()] + ' ' + months[date.getMonth()] + ' ' + date.getDate() + cptime;
    }
  } else {
    return days[date.getDay()] + ' ' + (date.getMonth() + 1) + "/" + pad2(date.getDate()) + "/" + pad2(date.getFullYear() % 100) + cptime;
  }
};

// Converts a filesize (in bytes) to a sensible size description
function sensibleSize(size) {
  size = parseInt(size);
  var sensibleSize;
  if (size < 1024/10) {
    sensibleSize = size + " B";
  } else if (size < 1024*1024/10) {
    sensibleSize = (size/1024).toPrecision(2) + " kB";
  } else {
    sensibleSize = (size/1024/1024).toPrecision(2) + " MB";
  }
};

function generateUUID(){
  var d = _.now();
  var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = (d + Math.random()*16)%16 | 0;
    d = Math.floor(d/16);
    return (c=='x' ? r : (r&0x3|0x8)).toString(16);
  });
  return uuid;
};

function generateGUID() {
  return (Math.random().toString(16).slice(2)
          + "-" + Math.random().toString(16).slice(2)
          + "-" + _.now().toString(36));
}

function pluralize(n, singular, plural) {
  if (plural === void 0) {
    plural = singular + 's';
  }
  if (n === 0) {
    return "0 " + plural;
  } else if (n === 1) {
    return "1 " + singular;
  } else {
    return n + " " + plural;
  }
}

// Futures

function Future(/*opt*/callbackAcceptor) {
  var fulfilled = false,
      rejected = false,
      onFulfilled = [],
      onRejected = [],
      value;

  _.extend(this, {
    addFulfilledHandler : function (handler) {
      if (fulfilled) {
        handler.apply(void 0, value);
      } else if (!rejected) {
        onFulfilled.push(handler);
      }
      return this;
    },
    addRejectedHandler : function (handler) {
      if (rejected) {
        handler.apply(void 0, value);
      } else if (!fulfilled) {
        onRejected.push(handler);
      }
      return this;
    },
    failure : function (onfail) {
      return this.then(void 0, onfail);
    },
    fulfill : function (/*args*/) {
      if (fulfilled || rejected) {
        throw new Error("Cannot fulfill non-pending promise.");
      }
      fulfilled = true;
      value = _.toArray(arguments);
      _.each(onFulfilled, function (f) {
        f.apply(void 0, value);
      });
      onFulfilled = null;
      onRejected = null;
      return this;
    },
    reject : function (/*args*/) {
      if (fulfilled || rejected) {
        throw new Error("Cannot fulfill non-pending promise.");
      }
      rejected = true;
      value = _.toArray(arguments);
      _.each(onRejected, function (f) {
        f.apply(void 0, value);
      });
      onFulfilled = null;
      onRejected = null;
      return this;
    },
    then : function (success, /*opt*/failure) {
      var result = new Future();
      var onSuccess, onFailure;

      function makeHandler(f) {
        return function handler() {
          try {
            var val = f.apply(void 0, arguments);
          } catch (x) {
            result.reject(x);
            return;
          }
          if (typeof val === "object" && val instanceof Future) {
            val.addFulfilledHandler(_.im(result, 'fulfill'));
            val.addRejectedHandler(_.im(result, 'reject'));
          } else {
            result.fulfill(val);
          }
        };
      }
      
      if (typeof success == "function") {
        onSuccess = makeHandler(success);
      } else {
        onSuccess = function propagateSuccess() {
          result.fulfill.apply(result, arguments);
        };
      }

      if (typeof failure == "function") {
        onFailure = makeHandler(failure);
      } else {
        onFailure = function propagateFailure() {
          result.reject.apply(result, arguments);
        };
      }

      this.addFulfilledHandler(onSuccess)
          .addRejectedHandler(onFailure);
      return result;
    }
  });

  if (typeof callbackAcceptor == "function") {
    try {
      callbackAcceptor(_.im(this, "fulfill"), _.im(this, "reject"));
    } catch (x) {
      this.reject(x);
    }
  }
}

// Events

function EventSystem(o, names) {
  var handlers = {};
  if (typeof names === "string") {
    names = names.match(/\S+/g);
  }
  _.each(names, function (name) {
    handlers[name] = [];
  });

  function get_list(name) {
    if (_.has(handlers, name)) {
      return handlers[name];
    } else {
      throw new Error("No such event named '" + name + "'");
    }
  }

  _.extend(this, {
    on : function (names, handler) {
      /* Returns a function which, when called, removes the event handler. */
      if (typeof names === "string") {
        names = names.match(/\S+/g);
      }
      _.each(names, function (name) {
        get_list(name).push(handler);
      });
      return _.im(this, "remove", handler);
    },
    notify : function (name /*args*/) {
      var args = [o].concat(_.toArray(arguments));
      _.each(get_list(name), function (f) {
          f.apply(void 0, args);
      });
    },
    remove : function (handler) {
      _.each(handlers, function (handlers, name) {
        var index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      });
    }
  });

  o.events = this;
}

// models

function addAccessor(cls, prop, /*opt*/update) {
  var setter = false;
  if (prop.charAt(0) === "!") {
    setter = true;
    prop = prop.slice(1);
  }
  var _prop = '_' + prop;
  function accessor(/*opt*/v) {
    if (arguments.length > 0) {
      if (!setter) throw new Error("Not settable: " + prop);
      this[_prop] = v;
      if (update) {
        update.call(this, prop);
      }
      return this;
    } else {
      return this[_prop];
    }
  }
  cls.prototype[prop] = accessor;
  return cls;
}
function addAccessors(cls, props, update) {
  _.each(props, function (prop) {
    addAccessor(cls, prop, update);
  });
  return cls;
}

var toUpdate = [];
var updateTimeout = null;
function doUpdate() {
  console.log("doUpdate");
  var thisToUpdate = toUpdate;
  toUpdate = [];
  updateTimeout = null;
  _.each(thisToUpdate, function (o) {
    o.doUpdate();
  });
}
function registerUpdate(o) {
  toUpdate.push(o);
  if (updateTimeout === null) {
    updateTimeout = window.setTimeout(doUpdate, 0);
  }
}

function Task() {
  this._id = null;

  this._title = "";
  this._notes = "";
  this._created = null;
  this._updated = null; // task responsible for updating
  this._version = null; // synchronizer responsible for updating

  this._parent = null;
  this._project_type = null;
  this._sort_order = null;

  this._starred = false;
  this._status = null;
  this._status_changed = null;

  this._tags = null;
  this._deadline = null;
  this._deleted = false;
  this._scheduled = null;
  this._work_history = null;
  this._recurring = null;
  this._defer = null;

  // internal
  this._modified = false;

  this._subtasks = [];

  new EventSystem(this, "updated");
}
addAccessors(Task, [
  "!id", "!title", "!notes",
  "!created", "updated",
  "!parent", "!project_type", "!sort_order",
  "!status_changed", "!starred",
  "!tags", "!deadline", "!deleted", "!scheduled", "!work_history", "!recurring",
  "!defer",

  "subtasks"
], function () {
  this.update();
});
addAccessors(Task, [
  "!version"
]);

Task.statuses = [null, "done"];
Task.prototype.status = function (/*opt*/status) {
  if (arguments.length > 0) {
    if (!_.contains(Task.statuses, status)) {
      throw new Error("Invalid status " + status);
    }
    this._status = status;
    this.status_changed(_.now());
    this.update();
    return this;
  } else {
    return this._status;
  }
};

Task.project_types = [null, "single action", "parallel", "sequential"];
Task.prototype.project_type = function (/*opt*/project_type) {
  if (arguments.length > 0) {
    if (!_.contains(Task.project_types, project_type)) {
      throw new Error("Invalid project type " + project_type);
    }
    this._project_type = project_type;
    this.update();
    return this;
  } else {
    return this._project_type;
  }
};

Task.prototype.update = function (/*opt*/updateTime) {
  if (updateTime === void 0) { updateTime = true; }

  if (updateTime) {
    this._updated = _.now();
  }
  if (!this._modified) {
    this._modified = true;
    registerUpdate(this);
  }
};
Task.prototype.doUpdate = function () {
  this._modified = false;
  this.events.notify("updated");
  if (this.parent()) {
    this.parent().events.notify("updated");
  }
};

Task.compare = function (a, b) {
  var soa = a.sort_order(), sob = b.sort_order();
  if (soa < sob) return -1;
  else if (soa > sob) return 1;
  else if (a.title() < b.title()) return -1;
  else if (a.title() > b.title()) return 1;
  else return 0;
};

Task.prototype.detachParent = function () {
  if (this.parent() !== null) {
    this.parent().removeSubtask(this);
    this.parent(null).sort_order(_.now());
  }
  return this;
};
Task.prototype.removeSubtask = function (task) {
  for (var i = 0; i < this._subtasks.length; i++) {
    if (this._subtasks[i] === task) {
      this._subtasks.splice(i, 1);
      break;
    }
  }
  this.update(false);
  return this;
};
Task.prototype.addSubtask = function (task, /*opt*/sort_order) {
  if (task.parent() === this
      && task.sort_order() !== null
      && sort_order === void 0) {
    return this;
  }

  // check parent for loops
  var curr = this;
  do {
    if (curr === task) return this;
    curr = curr.parent();
  } while (curr !== null);

  task.detachParent().parent(this);
  if (sort_order === void 0) {
    sort_order = lastSortOrder(this._subtasks);
  }
  task.sort_order(sort_order);
  this._subtasks.push(task);

  correctSortOrder(this._subtasks);
  this.update(false);

  return this;
};

Task.prototype.activeSubtasks = function () {
  return _.filter(this.subtasks(), function (st) { return st.active(); });
};

Task.prototype.active = function () {
  return !this.deleted() && this.status() !== "done";
};

Task.prototype.toDict = function () {
  var o = {
    id : this.id(),
    title : this.title(),
    notes : this.notes(),
    created : this.created(),
//    version : this.version(),

    parent : this.parent() ? this.parent().id() : null,
    project_type : this.project_type(),
    sort_order : this.sort_order(),
    starred : this.starred(),
    status : this.status(),
    status_changed : this.status_changed()
  };

  return o;
};
Task.prototype.updateFromDict = function (o, taskdb) {
  if (this.id() !== o.id) {
    throw new Error("incorrect id");
  }
  if (_.has(o, 'title') && this.title() !== o.title) {
    this.title(o.title);
  }
  if (_.has(o, 'notes') && this.notes() !== o.notes) {
    this.notes(o.notes);
  }
  if (_.has(o, 'created') && this.created() !== o.created) {
    this.created(o.created);
  }
  if (_.has(o, 'version') && this.version() !== o.version) {
    this.version(o.version);
  }
  if (_.has(o, 'parent')) {
    if (o.parent && (!this.parent() || o.parent !== this.parent().id())) {
      taskdb.ensureTask(o.parent).addSubtask(this);
    } else if (!o.parent && this.parent()) {
      this.detachParent();
    }
  }
  if (_.has(o, 'project_type') && this.project_type() !== o.project_type) {
    this.project_type(o.project_type);
  }
  if (_.has(o, 'sort_order') && this.sort_order() !== o.sort_order) {
    this.sort_order(o.sort_order);
  }
  if (_.has(o, 'starred') && this.starred() !== o.starred) {
    this.starred(o.starred);
  }
  if (_.has(o, 'status') && this.status() !== o.status) {
    this.status(o.status);
  }
  if (_.has(o, 'status_changed') && this.status_changed() !== o.status_changed) {
    this.status_changed(o.status_changed);
  }
};

function firstSortOrder(tasks) {
  var min_sort_order = _.min(_.invoke(tasks, 'sort_order'));
  return min_sort_order === Infinity ? 0 : min_sort_order - 1;
}
function lastSortOrder(tasks) {
  var max_sort_order = _.max(_.invoke(tasks, 'sort_order'));
  return max_sort_order === -Infinity ? 0 : max_sort_order + 1;
}
function afterSortOrder(tasks, subtask) {
  if (subtask.sort_order() === null) {
    subtask.sort_order(lastSortOrder(tasks));
  }
  var after_so = subtask.sort_order();
  var min_after_so = _.chain(tasks)
        .invoke('sort_order')
        .filter(function (v) { return v > after_so; })
        .min()
        .value();
  return min_after_so === Infinity ? after_so + 1 : (after_so + min_after_so) / 2;
}
function beforeSortOrder(tasks, subtask) {
  if (subtask.sort_order() === null) {
    subtask.sort_order(lastSortOrder(tasks));
  }
  var before_so = subtask.sort_order();
  var max_before_so = _.chain(tasks)
        .invoke('sort_order')
        .filter(function (v) { return v < before_so; })
        .min()
        .value();
  return max_before_so === Infinity ? before_so - 1 : (before_so + max_before_so) / 2;
};

function correctSortOrder(tasks) {
  var i;
  var max_so = -Infinity;
  for (i = 0; i < tasks.length; i++) {
    var so = tasks[i].sort_order();
    if (so !== null && so > max_so) max_so = so;
  }
  max_so = max_so === -Infinity ? 0 : max_so + 1;
  for (i = 0; i < tasks.length; i++) {
    if (tasks[i].sort_order() === null) tasks[i].sort_order(max_so++);
  }
  tasks.sort(Task.compare);
  if (tasks.length > 1) {
    var last_so = tasks[0].sort_order() - 1;
    for (i = 0; i < tasks.length - 1; i++) {
      if (tasks[i].sort_order() === tasks[i+1].sort_order()) {
        last_so = (last_so + tasks[i].sort_order())/2;
        tasks[i].sort_order(last_so);
      }
    }
  }
}

function WorkHistoryItem() {
  this.start = null;
  this.end = null;
}
addAccessors(WorkHistoryItem, [
  "!start", "!end"
]);

// Widgets

function FancyCheckbox() {
  this._checked = false;
  new EventSystem(this, "change");
  this._symbol = "fa-check";
  this._checkboxClass = "FancyCheckbox";
  this.on = this.events.on;
}
addAccessors(FancyCheckbox, [ "!symbol", "!checkboxClass" ]);
FancyCheckbox.create = function () {
  return new FancyCheckbox();
};
FancyCheckbox.prototype.render = function ($dest) {
  this.$el = $('<div>').appendTo($dest);
  this.$el
    .addClass(this.checkboxClass())
    .addClass("fa")
    .addClass(this.symbol());

  this.$el.on("click", _.im(this, "click"));
  return this;
};
FancyCheckbox.prototype.click = function (e) {
  if (e.which === 1) {
    e.stopPropagation();
    this.toggle();
  }
};
FancyCheckbox.prototype.toggle = function () {
  this._checked = !this._checked;
  this.update();
};
FancyCheckbox.prototype.check = function (/*opt*/check) {
  if (arguments.length > 0) {
    this._checked = !!check;
    this.update();
    return this;
  } else {
    return this._checked;
  }
};
FancyCheckbox.prototype.update = function () {
  this.$el.toggleClass("checked", this._checked);
  this.events.notify("change");
};


// Views

function ContextMenu() {
  this.$cloak = null;
  this.$el = null;
  this._closeCallback = null;
  this._useCloak = true;
}
addAccessors(ContextMenu, [
  "!useCloak"
]);
ContextMenu.prototype.render = function () {
  var $dest = $("body");
  this.$cloak = $('<div class="context-menu-cloak">').appendTo($dest);
  this.$el = $('<div class="context-menu">').appendTo($dest);

  this.$cloak.on("click contextmenu", _.im(this, function (e) {
    e.preventDefault();
    e.stopPropagation();
    this.deactivate();
  }));
  this.$el.on("click", _.im(this, function (e) {
    e.preventDefault();
    e.stopPropagation();
    this.deactivate();
  }));
  this.$el.on("contextmenu", _.im(this, function (e) {
    e.preventDefault();
    this.$el.click();
  }));
};
ContextMenu.prototype.activate = function ($target, position, /*opt*/closeCallback) {
  this._closeCallback = closeCallback;

  if (this.useCloak()) {
    this.$cloak.show();
  }
  this.$el.show();
  this.$el.css("max-height", "none");
  this.$el.css("width", "");

  var myheight = this.$el.outerHeight(),
      mywidth = this.$el.outerWidth();
  var toffset, twidth, theight;

  if (position === "mouse") {
    toffset = {top : $target.y, left : $target.x };
    twidth = 0;
    theight = 0;
    position = "vertical";
  } else {
    $target = $($target);
    toffset = $target.offset();
    twidth = $target.outerWidth();
    theight = $target.outerHeight();
  }

  if (position === "vertical") {
    
    if (toffset.top + theight + myheight < $(window).height()) {
      // below full
      this.$el.css("top", (toffset.top + theight) + "px");
    } else if (myheight < toffset.top) {
      // above full
      this.$el.css("top", (toffset.top - myheight) + "px");
    } else if (toffset.top < $(window).height() - toffset.top - theight) {
      // below partial
      this.$el.css("top", (toffset.top + theight) + "px");
      this.$el.css("max-height", ($(window).height() - toffset.top - theight) + "px");
      this.$el.css("width", this.$el.width() + 20);
    } else {
      // above partial
      this.$el.css("top", "0px");
      this.$el.css("max-height", (toffset.top) + "px");
      this.$el.css("width", this.$el.width() + 20);
    }
    // should it be to the right or the left?
    if (toffset.left + this.$el.width() < $(window).width()) {
      this.$el.css("left", (toffset.left) + "px");
    } else {
      this.$el.css("left", (toffset.left + twidth - this.$el.width()) + "px");
    }
  } else if (position === "submenu") {
    if (toffset.top + myheight < $(window).height()) {
      this.$el.css("top", toffset.top);
    } else {
      this.$el.css("top", toffset.top + theight - myheight);
    }
    if (toffset.left + twidth + mywidth < $(window).width()) {
      this.$el.css("left", toffset.left+twidth);
    } else {
      this.$el.css("left", toffset.left-mywidth);
    }
  } else {
    throw new Error("Unknown position");
  }
};
ContextMenu.prototype.deactivate = function () {
  this.$cloak.hide();
  this.$el.hide();
  if (this._closeCallback) {
    this._closeCallback();
  }
  this._closeCallback = null;
};


function ProjectSelector() {
  this._controller = null;
  this._active = false;
  this._task = null;
}
addAccessors(ProjectSelector, [
  "!controller", "!task"
]);
ProjectSelector.create = function (controller) {
  var ps = new ProjectSelector();
  ps.controller(controller);
  return ps;
};

ProjectSelector.prototype.render = function () {
  this.contextMenu = new ContextMenu();
  this.contextMenu.render();

  this.$projectList = $('<ul>').appendTo(this.contextMenu.$el);

  return this;
};

ProjectSelector.prototype.activate = function (task, $target, /*opt*/closeCallback) {
  this.task(task);

  this.fillProjects();
  this.contextMenu.activate($target, "vertical", closeCallback);
};

ProjectSelector.prototype.fillProjects = function () {
  this.$projectList.empty();
  var $remove = $('<li>').appendTo(this.$projectList);
  $remove.prepend($('<span class="ProjectSelector-projecticon">'));
  $remove.append($('<span class="ProjectSelector-projectname">').text("No project"));
  $remove.on("click", _.im(this, function (e) {
    this.task().detachParent();
  }));
  $('<li class="context-menu-divider">').appendTo(this.$projectList);

  function addProject(project, indent) {
    var $item = $('<li>').appendTo(this.$projectList);
    var $indent = $('<span class="ProjectSelector-indent">').appendTo($item);
    $indent.css("width", (16 * indent) + "px");
    var $icon = $('<span class="ProjectSelector-projecticon">').appendTo($item);
    $icon.append(icon_for_project_type(project.project_type()));
    var $text = $('<span class="ProjectSelector-projectname">').appendTo($item);
    if (project.title()) {
      $text.text(project.title());
    } else {
      $text.addClass("noname");
    }

    $item.on("click", _.im(this, function(e) {
      project.addSubtask(this.task());
    }));

    var subprojects = _.filter(project.activeSubtasks(),
                               function (st) { return st.project_type(); });
    subprojects.sort(Task.compare);

    _.each(subprojects, function (sp) {
      addProject.call(this, sp, indent+1);
    }, this);
  }

  var projects = this.controller().taskDB().getProjects();
  projects.sort(Task.compare);
  _.each(projects, function (project) {
    addProject.call(this, project, 0);
  }, this);
};

function TaskSettingsSelector() {
  this._controller = null;
  this._active = false;
  this._task = null;
}
addAccessors(TaskSettingsSelector, [
  "!controller", "!task"
]);
TaskSettingsSelector.create = function (controller) {
  var tss = new TaskSettingsSelector();
  tss.controller(controller);
  return tss;
};
TaskSettingsSelector.prototype.render = function () {
  this.contextMenu = new ContextMenu();
  this.contextMenu.render();
  this.$list = $('<ul>').appendTo(this.contextMenu.$el);

  this.projectContextMenu = new ContextMenu();
  this.projectContextMenu
    .useCloak(false)
    .render();
  
  this.$projectTypeList = $('<ul>').appendTo(this.projectContextMenu.$el);

  return this;
};
TaskSettingsSelector.prototype.activate = function (mouse, task, /*opt*/closeCallback) {
  this.task(task);
  this.fill();
  this.contextMenu.activate(mouse, "mouse", _.im(this, function () {
    this.projectContextMenu.deactivate();
    closeCallback();
  }));
};
TaskSettingsSelector.prototype.fill = function () {
  this.$list.empty();

  var nextStatusState = this.task().status() === "done" ? null : "done";
  var $complete = $('<li>').appendTo(this.$list);
  $complete.text(nextStatusState === "done" ? "Mark completed" : "Unmark completed");

  $complete.on("click", _.im(this, function (e) {
    this.task().status(nextStatusState);
  }));

  var nextStarState = !this.task().starred();
  var $star = $('<li>').appendTo(this.$list);
  $star.text(nextStarState ? "Star" : "Unstar");

  $star.on("click", _.im(this, function (e) {
    this.task().starred(nextStarState);
  }));

  var $projectType = $('<li class="submenu">').appendTo(this.$list);
  $projectType.text("Project type");

  $projectType.on("mouseover", _.im(this, function (e) {
    e.stopPropagation();
    $projectType.addClass("active");
    this.projectContextMenu.activate($projectType, "submenu");
  }));
  this.$list.on("mouseover", _.im(this, function (e) {
    $projectType.removeClass("active");
    this.projectContextMenu.deactivate();
  }));
  
  this.$projectTypeList.empty();
  var types = [[null, "None"],
               ["parallel", "Parallel"],
               ["sequential", "Sequential"],
               ["single action", "Single action"]];

  _.each(types, _.im(this, function (desc) {
    var $item = $('<li>').appendTo(this.$projectTypeList);
    var $icon = $('<span class="ProjectTypeSelector-projecticon">').appendTo($item);
    $icon.append(icon_for_project_type(desc[0]));
    var $text = $('<span class="ProjectTypeSelector-projectname">').appendTo($item);
    $text.text(desc[1]);

    $item.on("click", _.im(this, function(e) {
      this.contextMenu.deactivate();
      this.task().project_type(desc[0]);
    }));
  }));

  var $createSubtask = $('<li>').appendTo(this.$list);
  $createSubtask.text("Create subtask");
  $createSubtask.on("click", _.im(this, function (e) {
    var task = this.controller().taskDB().createTask();
    this.controller().taskSelectionController().createdTask(task);
    this.task().addSubtask(task);
  }));

  $('<li class="context-menu-divider">').appendTo(this.$list);

  var nextDeleteState = !this.task().deleted();
  var $delete = $('<li>').appendTo(this.$list);
  $delete.text(nextDeleteState ? "Delete" : "Restore");

  $delete.on("click", _.im(this, function (e) {
    this.task().deleted(nextDeleteState);
  }));

};

function TaskView() {
  this._controller = null;
  this._task = null;
  this._indent = 0;
  this._showSubtasks = false;
  this._asSubtask = false;

  this._taskListView = null;

  this.notes = null;
}
TaskView.create = function (controller, task) {
  var tv = new TaskView();
  return tv.task(task).controller(controller);
};
addAccessors(TaskView, [
  "!controller", "!indent", "!showSubtasks", "!taskListView", "!asSubtask"
]);

TaskView.prototype.task = function (/*opt*/task) {
  if (arguments.length > 0) {
    this._task = task;
    if (this.removeTaskUpdateHandler) {
      this.removeTaskUpdateHandler();
    }
    this.removeTaskUpdateHandler = task ? task.events.on("updated", _.im(this, "taskUpdated")) : null;
    return this;
  } else {
    return this._task;
  }
};

TaskView.prototype.controller = function (/*opt*/controller) {
  if (arguments.length > 0) {
    this._controller = controller;
    if (this.removeDragStartHandler) {
      this.removeDragStartHandler();
      this.removeDragEndHandler();
    }
    this.removeDragStartHandler = controller ? controller.dragController().events.on("dragstart", _.im(this, "controllerDragStart")) : null;
    this.removeDragEndHandler = controller ? controller.dragController().events.on("dragend", _.im(this, "controllerDragEnd")) : null;
    return this;
  } else {
    return this._controller;
  }
};

function indentPadding(indent) {
  return indent * 24 + 3;
}

TaskView.prototype.updateIndent = function () {
  if (this.$el) {
    this.$container.css("padding-left", indentPadding(this.indent()) + "px");
  }
  return this;
};

TaskView.prototype.detach = function () {
  if (this.taskListView()) {
    this.taskListView().remove();
  }
  if (this.$el) {
    this.$el.remove();
    this.$el = null;
  }
};

TaskView.prototype.remove = function () {
  this.detach();
  this.task(null);
  this.controller(null);
};

TaskView.prototype.makeNotesArea = function (initial) {
  this.$notesButton.removeClass("transient").addClass("unbutton");
  this.$notesArea = $('<div class="TaskView-notes">').appendTo(this.$titleArea);
  this.notes = CodeMirror(this.$notesArea[0], {
    value : initial,
    mode : "text",
    placeholder : "Notes...",
    lineWrapping: true,
    viewportMargin: Infinity,
    extraKeys : {
      Tab : false,
      "Shift-Tab" : false,
      "Shift-Enter" : function () {console.log("se"); }
    }
  });

  this.notes.on("focus", _.im(this, "gainFocus"));
  this.notes.on("blur", _.im(this, "loseFocus"));

  this.notes.on("blur", _.im(this, "notesChanged"));
};

TaskView.prototype.render = function ($dest) {
  this.detach();
  this.$el = $('<div class="TaskView">').appendTo($dest);

  this.$container = $('<div class="TaskView-container" draggable="true">').appendTo(this.$el);
  this.updateIndent();

  this.$checkArea = $('<div class="TaskView-check">').appendTo(this.$container);
  var $mainArea = $('<div class="TaskView-main">').appendTo(this.$container);
  this.$iconArea = $('<div class="TaskView-iconArea">').appendTo($mainArea);
  this.$titleArea = $('<div class="TaskView-titleArea">').appendTo($mainArea);

  this.$dragDest = $('<div class="TaskView-dragDest">').appendTo(this.$container);

  this.$title = $('<input class="TaskView-title" type="text" placeholder="Untitled">').appendTo(this.$titleArea);
  this.$title.val(this.task().title());
  this.starcheck = FancyCheckbox.create()
    .symbol("fa-star")
    .checkboxClass("TaskStar")
    .render(this.$checkArea);
  this.$checkArea.append($('<div class="em-spacer">'));
  this.starred(this.task().starred());
  this.check = FancyCheckbox.create().render(this.$checkArea);
//  this.$check = $('<input type="checkbox" tabindex="-1">').appendTo(this.$checkArea);
  this.status(this.task().status());

  var $secondArea = $('<div class="TaskView-secondArea">').appendTo(this.$titleArea);
  this.$notesButton = $('<div class="fa fa-pencil TaskView-button transient" title="Notes">').appendTo($secondArea);
  this.$notesButton.on("click", _.im(this, function (e) {
    e.preventDefault();
    if (!this.notes) {
      this.makeNotesArea(this.task().notes());
      this.notes.focus();
    } else {
      this.notes.focus();
    }
  }));

  $secondArea.append('<div class="TaskView-button-spacer">');
  
  this.$projectButton = $('<div class="TaskView-button transient" title="Project">').appendTo($secondArea);
  this.$projectButton.on("click contextmenu", _.im(this, function (e) {
    e.preventDefault();
    e.stopPropagation();
    this.controller().taskSelectionController().setSelection(this);
    this.$projectButton.addClass("active");
    this.controller().projectSelector().activate(this.task(), this.$projectButton,
                                                 _.im(this, function () {
                                                   this.$projectButton.removeClass("active");        
                                                 }));
  }));

  if (this.task().notes()) {
    this.makeNotesArea(this.task().notes());
  }

  this.updateProjectProperties();

  if (this.showSubtasks()) {
    this.taskListView(TaskListView.create(this.controller()).indent(this.indent()+1));
    this.taskListView().viewFactory(_.im(this, function (task) {
      var tv = TaskView.create(this.controller(), task);
      tv.showSubtasks(true).asSubtask(true);
      return tv;
    }));
    this.taskListView().oldTaskViewFilter(_.im(this, function (tv) {
      return tv.task().parent() === this.task();
    }));
    this.taskListView().insertionFunction(_.im(this, function (task, after) {
      if (after === void 0) {
        this.task().addSubtask(task, firstSortOrder(this.task().subtasks()));
      } else {
        this.task().addSubtask(task, afterSortOrder(this.task().subtasks(), after));
      }
    }));
    this.$subtasks = $('<div class="TaskView-subtasks">').appendTo(this.$el);
    this.taskListView().render(this.$subtasks).updateSubtasks(this.task().activeSubtasks());
  }

  this.$container.on("click", _.im(this, "clickedContainer"));
  this.$container.on("contextmenu", _.im(this, "contextMenu"));

  this.$title.on("change", _.im(this, "titleChanged"));
  this.$title.on("focus", _.im(this, "gainFocus"));
  this.$title.on("blur", _.im(this, "loseFocus"));

  this.starcheck.on("change", _.im(this, "starredChanged"));
  this.check.on("change", _.im(this, "statusChanged"));

  this.$container.on("dragstart", _.im(this, "handleDragStart"));
  this.$container.on("dragend", _.im(this, "handleDragEnd"));
  this.$dragDest.on("dragover drageenter", _.im(this, "handleDragOver"));
  this.$dragDest.on("dragleave", _.im(this, "handleDragLeave"));
  this.$dragDest.on("drop", _.im(this, "handleDrop"));

  if (this.controller().taskSelectionController().isCreatedTask(this.task())) {
    this.$title.focus();
//    this.controller().taskSelectionController().setSelection(this);
  } else {
    this.controllerUnselect();
  }
};

TaskView.prototype.titleChanged = function () {
  var newTitle = this.$title.val();
  if (newTitle !== this.task().title()) {
    this.task().title(newTitle);
  }
};

TaskView.prototype.notesChanged = function () {
  var newNotes = this.notes.getValue();
  if (newNotes !== this.task().notes()) {
    this.task().notes(newNotes);
  }
};

TaskView.prototype.statusChanged = function () {
  var newStatus = this.status();
  if (newStatus !== this.task().status()) {
    this.task().status(newStatus);
  }
};

TaskView.prototype.starredChanged = function () {
  var newStatus = this.starred();
  if (newStatus !== this.task().starred()) {
    this.task().starred(newStatus);
  }
};

TaskView.prototype.clickedContainer = function (e) {
  var controller = this.controller().taskSelectionController();

  if (e.which === 1) {
    if (e.shiftKey) {
      controller.addToSelection(this);
    } else if (e.ctrlKey) {
      controller.toggleSelection(this);
    } else {
      controller.setSelection(this);
    }
  }
};

TaskView.prototype.contextMenu = function (e) {
  this.controller().taskSelectionController().setSelection(this);
  if (this.$container.attr("draggable") !== "true") return;
//  if (e.target.tag === "INPUT" !== this.$container[0]) return;
  e.preventDefault();
  e.stopPropagation();
  this.controller().taskSettingsSelector().activate(
    {x : e.clientX, y : e.clientY},
    this.task(),
    _.noop
  );
};

TaskView.prototype.gainFocus = function () {
  this.$container.attr("draggable", "false");
  this.controller().taskSelectionController().setSelection(this);
  if (this.$el[0].scrollIntoViewIfNeeded) {
    this.$el[0].scrollIntoViewIfNeeded();
  }
  this.controller().globalKeyHandler().pushKeyMap({
    'S-<return>' : _.im(this, function (e) {
      var task = this.controller().taskDB().createTask();
      this.controller().taskSelectionController().createdTask(task);
      if (this.task().project_type() || !this.task().parent()) {
        this.task().addSubtask(task);
      } else {
        this.task().parent().addSubtask(task);
      }
    })
  });
};
TaskView.prototype.loseFocus = function () {
  this.$container.attr("draggable", "true");
  this.controller().globalKeyHandler().popKeyMap();
};

TaskView.prototype.focus = function () {
  this.controller().taskSelectionController().setSelection(this);
  this.$title.focus();
};

TaskView.prototype.controllerSelect = function () {
  this.$container.toggleClass("selected", true);
};

TaskView.prototype.controllerUnselect = function () {
  this.$container.toggleClass("selected", false);
};

function icon_for_project_type(project_type) {
  switch (project_type) {
  case "single action" :
    return ($('<div class="batch-icon">&#xf0e4;</div>'));
  case "parallel" :
    return ($('<div class="batch-icon">&#xf11b;</div>'));
  case "sequential" :
    return ($('<div class="batch-icon">&#xf0a7;</div>'));
  default:
    return void 0;
  }

}

TaskView.prototype.updateProjectProperties = function () {
  this.$title.toggleClass("project", null !== this.task().project_type());
  this.$checkArea.toggle(null === this.task().project_type());
  this.$iconArea.empty().append(icon_for_project_type(this.task().project_type()));
//  this.$iconArea.toggleClass("transient", !this.task().project_type());

  if (this.task().parent()) {
    this.$projectButton.text(this.task().parent().title());
  } else {
    this.$projectButton.text("No project");
  }
  this.$projectButton.toggleClass("transient", this.asSubtask() || !this.task().parent());
};

TaskView.prototype.taskUpdated = function () {
  if (!this.$el) return;

  this.updateProjectProperties();

  // title
  if (this.task().title() !== this.$title.val()) {
    this.$title.val(this.task().title());
  }

  // status
  if (this.task().status() !== this.status()) {
    this.status(this.task().status());
  }

  // starred
  if (this.task().starred() !== this.starred()) {
    this.starred(this.task().starred());
  }

  // note
  if (this.task().notes() && !this.notes) {
    this.makeNotesArea(this.task().notes());
  } else if (this.notes && this.task().notes() !== this.notes.getValue()) {
    var newNotes = this.task().notes();
    this.notes.setValue(newNotes);
    if (newNotes) {
      this.$notesArea.show();
      this.notes.refresh();
    } else {
      this.notes.hide();
    }
  }

  if (this.taskListView()) {
    this.taskListView().updateSubtasks(this.task().activeSubtasks());
  }
};

TaskView.prototype.status = function (/*opt*/status) {
  if (arguments.length > 0) {
//    this.$check.prop("checked", status === "done");
    this.check.check(status === "done");
    return this;
  } else {
//    return this.$check.prop("checked") ? "done" : null;
    return this.check.check() ? "done" : null;
  }
};

TaskView.prototype.starred = function (/*opt*/starred) {
  if (arguments.length > 0) {
//    this.$check.prop("checked", status === "done");
    this.starcheck.check(starred);
    return this;
  } else {
//    return this.$check.prop("checked") ? "done" : null;
    return this.starcheck.check();
  }
};

TaskView.prototype.handleDragStart = function (e) {
  var dto = e.originalEvent.dataTransfer;
  dto.dragEffect = "copy";
  var textData = this.task().title();
  if (this.task().notes()) {
    textData += "\n" + this.task().notes();
  }
  dto.setData('Text', textData);

  this.controller().taskSelectionController().selectionOn(this);
  this.controller().dragController().startDrag(_.invoke(this.controller().taskSelectionController().selection(), "task"));
};

TaskView.prototype.handleDragEnd = function (e) {
  this.controller().dragController().endDrag();
};

TaskView.prototype.controllerDragStart = function () {
  this.$dragDest.toggleClass("active", true);
  this.$dragDest.css("width", this.$container.outerWidth()+4);
  this.$dragDest.css("height", this.$container.outerHeight()+4);
};
TaskView.prototype.controllerDragEnd = function () {
  this.$dragDest.toggleClass("active", false);
  this.$dragDest.toggleClass("visible", false);
};

TaskView.prototype.handleDragOver = function (e) {
  var dto = e.originalEvent.dataTransfer;
  if (this.controller().dragController().draggedTasks()) {
    e.preventDefault();
    e.stopPropagation();
    dto.dropEffect = 'copy';
    this.$dragDest.toggleClass("visible", true);
    return false;
  }
};
TaskView.prototype.handleDragLeave = function (e) {
  var dto = e.originalEvent.dataTransfer;
  this.$dragDest.toggleClass("visible", false);
};
TaskView.prototype.handleDrop = function (e) {
  e.stopPropagation();
  if (this.controller().dragController().draggedTasks()) {
    var toDrop = this.controller().dragController().draggedTasks().slice(0);
    toDrop.sort(function (a, b) {
      return Task.compare(a, b);
    });
    _.each(toDrop, function (task) {
      this.task().addSubtask(task);
    }, this);
    this.controller().dragController().endDrag();
    this.controller().taskSelectionController().clearSelection();
    return false;
  }
};

function ProjectTaskView() {
  this._controller = null;
  this._task = null;
  this._indent = 0;
  this._taskListView = null;
  this._click = null;
}
ProjectTaskView.create = function (controller, task) {
  var tv = new ProjectTaskView();
  return tv.task(task).controller(controller);
};
addAccessors(ProjectTaskView, [
  "!controller", "!indent", "!taskListView", "!click"
]);

ProjectTaskView.prototype.task = function (/*opt*/task) {
  if (arguments.length > 0) {
    this._task = task;
    if (this.removeTaskUpdateHandler) {
      this.removeTaskUpdateHandler();
    }
    this.removeTaskUpdateHandler = task ? task.events.on("updated", _.im(this, "refresh")) : null;
    return this;
  } else {
    return this._task;
  }
};

ProjectTaskView.prototype.controller = function (/*opt*/controller) {
  if (arguments.length > 0) {
    this._controller = controller;
    if (this.removeDragStartHandler) {
      this.removeDragStartHandler();
      this.removeDragEndHandler();
    }
    this.removeDragStartHandler = controller ? controller.dragController().events.on("dragstart", _.im(this, "controllerDragStart")) : null;
    this.removeDragEndHandler = controller ? controller.dragController().events.on("dragend", _.im(this, "controllerDragEnd")) : null;
    return this;
  } else {
    return this._controller;
  }
};

ProjectTaskView.prototype.updateIndent = function () {
  if (this.$el) {
    this.$container.css("padding-left", indentPadding(this.indent()) + "px");
  }
  return this;
};

ProjectTaskView.prototype.detach = function () {
  if (this.taskListView()) {
    this.taskListView().remove();
  }
  if (this.$el) {
    this.$el.remove();
    this.$el = null;
  }
};

ProjectTaskView.prototype.render = function ($dest) {
  this.detach();
  this.$el = $('<div class="ProjectTaskView">').appendTo($dest);
  this.$container = $('<div class="ProjectTaskView-container" draggable="true">').appendTo(this.$el);
  this.$container.attr("data-project-id", this.task().id());
  this.updateIndent();

  this.$iconArea = $('<div class="ProjectTaskView-iconArea">').appendTo(this.$container);
  this.$title = $('<div class="ProjectTaskView-title">').appendTo(this.$container);

  this.$dragDest = $('<div class="ProjectTaskView-dragDest">').appendTo(this.$container);

  this.taskListView(TaskListView.create(this.controller()));
  this.taskListView()
    .indent(this.indent()+1)
    .viewFactory(_.im(this, function (task) {
      var tv = ProjectTaskView.create(this.controller(), task);
      tv.click(this.click());
      return tv;
    }))
    .oldTaskViewFilter(_.im(this, function (tv) {
      return tv.task().parent() === this.task();
    }))
    .insertionFunction(_.im(this, function (task, after) {
      if (after === void 0) {
        this.task().addSubtask(task, firstSortOrder(this.task().subtasks()));
      } else {
        this.task().addSubtask(task, afterSortOrder(this.task().subtasks(), after));
      }
    }));
  this.$subtasks = $('<div class="ProjectTaskView-subtasks">').appendTo(this.$el);
  this.taskListView().render(this.$subtasks);

  this.$container.on("click", _.im(this, "clickedContainer"));

  this.$container.on("dragstart", _.im(this, "handleDragStart"));
  this.$container.on("dragend", _.im(this, "handleDragEnd"));
  this.$dragDest.on("dragover drageenter", _.im(this, "handleDragOver"));
  this.$dragDest.on("dragleave", _.im(this, "handleDragLeave"));
  this.$dragDest.on("drop", _.im(this, "handleDrop"));

  this.controllerUnselect();

  this.refresh();
};

ProjectTaskView.prototype.refresh = function () {
  this.$title.text(this.task().title());
  this.$title.toggleClass("noname", !this.task().title());
  this.$iconArea.empty().append(icon_for_project_type(this.task().project_type()));

  if (this.taskListView()) {
    this.taskListView().updateSubtasks(_.filter(this.task().activeSubtasks(),
                                               function (task) {
                                                 return task.project_type() !== null;
                                               }));
  }
};

ProjectTaskView.prototype.remove = function () {
  this.detach();
  this.task(null);
  this.controller(null);
};

ProjectTaskView.prototype.clickedContainer = function (e) {
  var controller = this.controller().taskSelectionController();

  if (e.which === 1) {
    if (e.shiftKey) {
      controller.addToSelection(this);
    } else if (e.ctrlKey) {
      controller.toggleSelection(this);
    } else {
      this.click()(this.task());
//      controller.setSelection(this);
    }
  }
};

ProjectTaskView.prototype.controllerSelect = function () {
  this.$container.toggleClass("selected", true);
};

ProjectTaskView.prototype.controllerUnselect = function () {
  this.$container.toggleClass("selected", false);
};

ProjectTaskView.prototype.handleDragStart = function (e) {
  var dto = e.originalEvent.dataTransfer;
  dto.dragEffect = "copy";
  var textData = this.task().title();
  if (this.task().notes()) {
    textData += "\n" + this.task().notes();
  }
  dto.setData('Text', textData);

  this.controller().taskSelectionController().selectionOn(this);
  this.controller().dragController().startDrag(_.invoke(this.controller().taskSelectionController().selection(), "task"));
};

ProjectTaskView.prototype.handleDragEnd = function (e) {
  this.controller().dragController().endDrag();
};

ProjectTaskView.prototype.controllerDragStart = function () {
  this.$dragDest.toggleClass("active", true);
  this.$dragDest.css("width", this.$container.outerWidth()+4);
  this.$dragDest.css("height", this.$container.outerHeight()+4);
};
ProjectTaskView.prototype.controllerDragEnd = function () {
  this.$dragDest.toggleClass("active", false);
  this.$dragDest.toggleClass("visible", false);
};

ProjectTaskView.prototype.handleDragOver = function (e) {
  var dto = e.originalEvent.dataTransfer;
  if (this.controller().dragController().draggedTasks()) {
    e.preventDefault();
    e.stopPropagation();
    dto.dropEffect = 'copy';
    this.$dragDest.toggleClass("visible", true);
    return false;
  }
};
ProjectTaskView.prototype.handleDragLeave = function (e) {
  var dto = e.originalEvent.dataTransfer;
  this.$dragDest.toggleClass("visible", false);
};
ProjectTaskView.prototype.handleDrop = function (e) {
  e.stopPropagation();
  if (this.controller().dragController().draggedTasks()) {
    var toDrop = this.controller().dragController().draggedTasks().slice(0);
    toDrop.sort(function (a, b) {
      return Task.compare(a, b);
    });
    _.each(toDrop, function (task) {
      this.task().addSubtask(task);
    }, this);
    this.controller().dragController().endDrag();
    this.controller().taskSelectionController().clearSelection();
    return false;
  }
};


function TaskListView() {
  this._controller = null;
  this._indent = 0;
  this._viewFactory = null;
  this._oldTaskViewFilter = _.noop;
  this._insertionFunction = null;
  this._subtaskViews = [];
}
TaskListView.create = function (controller) {
  var v = new TaskListView();
  return v.controller(controller);
}
addAccessors(TaskListView, [
  "!indent", "!viewFactory", "!subtaskViews", "!oldTaskViewFilter", "!insertionFunction"
]);

TaskListView.prototype.controller = function (/*opt*/controller) {
  if (arguments.length > 0) {
    this._controller = controller;
    if (this.removeDragStartHandler) {
      this.removeDragStartHandler();
      this.removeDragEndHandler();
    }
    this.removeDragStartHandler = controller ? controller.dragController().events.on("dragstart", _.im(this, "controllerDragStart")) : null;
    this.removeDragEndHandler = controller ? controller.dragController().events.on("dragend", _.im(this, "controllerDragEnd")) : null;
    return this;
  } else {
    return this._controller;
  }
};

TaskListView.prototype.detach = function () {
  _.each(this.subtaskViews(), function (stv) {
    stv.remove();
  });
  this.subtaskViews([]);
  if (this.$el) {
    this.$el.remove();
    this.$el = null;
  }
};

TaskListView.prototype.remove = function () {
  this.detach();
  this.controller(null);
};

TaskListView.prototype.render = function ($dest) {
  this.detach();
  this.$el = $('<div class="TaskListView">').appendTo($dest);

  this.$el.on("dragover dragenter", _.im(this, "handleDragOver"));
  this.$el.on("dragleave", _.im(this, "handleDragLeave"));
  this.$el.on("drop", _.im(this, "handleDrop"));
  return this;
};

TaskListView.prototype.clear = function () {
  _.each(this.subtaskViews(), function (tv) { tv.remove(); });
  this.subtaskViews([]);
  return this;
};

TaskListView.prototype.updateSubtasks = function (newTasks) {
  var wantedIds = {};
  _.each(newTasks, function (t) { wantedIds[t.id()] = true; });
  var old_stvs = {};
  _.each(this.subtaskViews(), function (stv) {
    if (_.has(wantedIds, stv.task().id())
        || (!stv.task().deleted() && this.oldTaskViewFilter()(stv))) {
      old_stvs[stv.task().id()] = stv;
    } else {
      stv.remove();
    }
  }, this);
  var new_stvs = [];
  _.each(newTasks, function (st) {
    if (_.has(old_stvs, st.id())) {
      new_stvs.push(old_stvs[st.id()]);
      delete old_stvs[st.id()];
    } else {
      var stv = this.viewFactory()(st);
      stv.indent(this.indent());
      new_stvs.push(stv);
    }
  }, this);
  _.each(old_stvs, function (stv) {
    new_stvs.push(stv);
  }, this);
  new_stvs.sort(function (a, b) {
    return Task.compare(a.task(), b.task());
  });

  if (new_stvs.length !== 0 && new_stvs.length === this.subtaskViews().length
      && _.every(_.zip(new_stvs, this.subtaskViews()), function (stvs) {return stvs[0] === stvs[1]; })) {
    console.log("skipping updateSubtasks");
    return this;
  }
  console.log("noskip");
  this.$el.children(".TaskListView-interitem-drop").remove();

  function MakeDropTarget(after_id) {
    var $drop = $('<div class="TaskListView-interitem-drop">').appendTo(this.$el);
    var $target = $('<div class="TaskListView-interitem-drop-target">').appendTo($drop);
    $drop.css("margin-left", indentPadding(this.indent()));
    $drop.css("width", "calc(100% - " + indentPadding(this.indent()) + "px)");
    $drop.css("z-index", 23 + this.indent());
    $drop.attr("insert-after", after_id);
  }

  if (this.insertionFunction()) {
    _.im(this, MakeDropTarget)("");
  }

  _.each(new_stvs, function (stv) {
    if (stv.$el) {
      stv.$el.appendTo(this.$el);
    } else {
      stv.render(this.$el);
    }
    if (this.insertionFunction()) {
      _.im(this, MakeDropTarget)(stv.task().id());
    }
  }, this);
  this.subtaskViews(new_stvs);

  return this;
};

TaskListView.prototype.controllerDragStart = function () {
  this.$el.children(".TaskListView-interitem-drop").toggleClass("active", true);
};
TaskListView.prototype.controllerDragEnd = function () {
  this.$el.children(".TaskListView-interitem-drop").toggleClass("active", false);
  this.$el.children(".TaskListView-interitem-drop").toggleClass("visible", false);
};

TaskListView.prototype.handleDragOver = function (e) {
  var target = $(e.target);
  if (!target.hasClass("TaskListView-interitem-drop")) {
    return;
  }
  var dto = e.originalEvent.dataTransfer;
  if (this.controller().dragController().draggedTasks()) {
    e.preventDefault();
    e.stopPropagation();
    dto.dropEffect = 'copy';
    target.toggleClass("visible", true);
    return false;
  }
};
TaskListView.prototype.handleDragLeave = function (e) {
  var target = $(e.target);
  if (!target.hasClass("TaskListView-interitem-drop")) {
    return;
  }
  e.stopPropagation();
  var dto = e.originalEvent.dataTransfer;
  target.toggleClass("visible", false);
};
TaskListView.prototype.handleDrop = function (e) {
  var target = $(e.target);
  if (!target.hasClass("TaskListView-interitem-drop")) {
    return;
  }
  e.stopPropagation();
  if (this.controller().dragController().draggedTasks()) {
    var insert_id = target.attr("insert-after");
    var after_stv = _.find(this.subtaskViews(), function (stv) { return stv.task().id() === insert_id; });
    var toInsert = this.controller().dragController().draggedTasks().slice(0);
    toInsert.sort(function (a, b) {
      return Task.compare(b, a);
    });
    _.each(toInsert, function (task) {
      if (after_stv) {
        this.insertionFunction()(task, after_stv.task());
      } else {
        this.insertionFunction()(task);
      }
    }, this);
    this.controller().dragController().endDrag();
    this.controller().taskSelectionController().clearSelection();
    return false;
  }
};

function TaskDatabase() {
  this._tasks = [];
  this._id_to_task = {};

  this.refreshTimeout = null;

  new EventSystem(this, "created updated");
}

TaskDatabase.prototype.createTask = function () {
  var t = new Task();
  t.id(generateGUID()).created(_.now()).sort_order(_.now());
  this._tasks.push(t);
  this._id_to_task[t.id()] = t;
  this.events.notify("created", t);
  t.events.on("updated", _.im(this, "handleUpdated"));
  return t;
};
TaskDatabase.prototype.ensureTask = function (id) {
  if (_.has(this._id_to_task, id)) {
    return this._id_to_task[id];
  } else {
    var t = new Task();
    t.id(id).created(_.now()).sort_order(_.now());
    this._tasks.push(t);
    this._id_to_task[t.id()] = t;
    this.events.notify("created", t);
    t.events.on("updated", _.im(this, "handleUpdated"));
    return t;
  }  
};

TaskDatabase.prototype.handleUpdated = function (task) {
  this.events.notify("updated", task);
};

TaskDatabase.prototype.getProjects = function () {
  return _.chain(this._tasks)
    .filter(function (task) {
      return !task.deleted() && task.parent() === null && task.status() === null && task.project_type() !== null;
    })
    .value();
};

TaskDatabase.prototype.getInbox = function () {
  return _.chain(this._tasks)
    .filter(function (task) {
      return !task.deleted() && task.parent() === null && task.status() === null && task.project_type() === null;
    })
    .value();
};

function DatabaseSynchronizer() {
  this._taskDB = null;
  this._changedIds = {};
  this._backingObjects = {};
  this._toSend = {};
  this._nextSince = -1;
  this.syncTimeout = null;
  this.sendTimeout = null;
  this._sendDelay = 1000 * 2;
  this._receiveDelay = 1000 * 20;
}
addAccessors(DatabaseSynchronizer, [
  "!sendDelay", "!nextSince", "!receiveDelay"
]);
DatabaseSynchronizer.prototype.taskDB = function (/*opt*/taskDB) {
  if (arguments.length > 0) {
    this._taskDB = taskDB;
    if (this.removeTaskDBHandler) {
      this.removeTaskDBHandler();
    }
    this.removeTaskDBHandler = taskDB.events.on("created updated", _.im(this, "taskChanged"));
    return this;
  } else {
    return this._taskDB;
  }
};
DatabaseSynchronizer.prototype.taskChanged = function (taskDB, event, task) {
  this._changedIds[task.id()] = task;
  if (!this.syncTimeout) {
    this.syncTimeout = window.setTimeout(_.im(this, 'deferSynchronize'), 0);
  }
};
DatabaseSynchronizer.prototype.deferSynchronize = function () {
  if (this.syncTimeout) {
    window.clearTimeout(this.syncTimeout);
    this.syncTimeout = null;
  }
  var changed = false;
  _.each(this._changedIds, function (task) {
    var o = task.toDict();
    if (!_.has(this._backingObjects, task.id())
        || !_.isEqual(o, this._backingObjects[task.id()])) {
      task.version(task.updated());
      this._backingObjects[o.id] = o;
      this._toSend[o.id] = true;
      changed = true;
    }
  }, this);
  this._changedIds = {};

  if (changed && !this.sendTimeout) {
    this.sendTimeout = window.setTimeout(_.im(this, 'deferSend'), this.sendDelay());
  }
};
DatabaseSynchronizer.prototype.deferSend = function () {
  if (this.sendTimeout) {
    window.clearTimeout(this.sendTimeout);
    this.sendTimeout = null;
  }
  var senddata = [];
  _.each(this._toSend, function (b, id) {
    // have to keep version out of backingObject so that _.isEqual works
    var o = _.clone(this._backingObjects[id]);
    o.version = this.taskDB()._id_to_task[id].version();
    senddata.push(o);
  }, this);
  console.log("Saving", _.pluck(senddata, "id"));
  console.log(JSON.stringify(senddata));
  Request("save", {tasks : senddata})
    .then(_.im(this, function () {
      console.log("heard from server");
      this._toSend = {};
    }), _.im(this, function (message) {
      console.error(message);
    }));
};
DatabaseSynchronizer.prototype.receive = function () {
  if (this._receiveTimeout) {
    window.clearTimeout(this._receiveTimeout);
    this._receiveTimeout = null;
  }
  Request("tasks", { since : this.nextSince() })
    .then(_.im(this, function (data) {
        console.log("Received tasks");
      _.each(data.tasks, function (taskstring) {
        console.log(taskstring);
        var tdict = JSON.parse(taskstring);
        var t = this.taskDB().ensureTask(tdict.id);
        if (t.version())
        console.log(t.version(), tdict.version);
        if (!t.version() || (t.version() && t.version() < tdict.version)) {
          t.updateFromDict(tdict, this.taskDB());
          delete tdict.version;
          this._backingObjects[tdict.id] = tdict;
        }
      }, this);
      this.nextSince(data.next_since);

      this._receiveTimeout = window.setTimeout(_.im(this, "receive"), this.receiveDelay());
    }), _.im(this, function (message) {
      console.error(message);
      this._receiveTimeout = window.setTimeout(_.im(this, "receive"), this.receiveDelay());
    }))
    .failure(function () {
      this._receiveTimeout = window.setTimeout(_.im(this, "receive"), this.receiveDelay());
      console.error(arguments);
    });
};

function InboxView() {
  this._taskDB = null;
  this._controller = null;
  this._taskListView = null;
}

addAccessors(InboxView, [
  "!controller", "!taskListView"
]);

InboxView.prototype.taskDB = function (/*opt*/taskDB) {
  if (arguments.length > 0) {
    this._taskDB = taskDB;
    if (this.removeTaskDBCreateHandler) {
      this.removeTaskDBCreateHandler();
    }
    this.removeTaskDBCreateHandler = taskDB.events.on("created updated", _.im(this, "taskCreated"));
    return this;
  } else {
    return this._taskDB;
  }
};

InboxView.prototype.taskCreated = function (task) {
  if (!this.refreshTimeout) {
    this.refreshTimeout = window.setTimeout(_.im(this, "refresh"), 0);
  }
};

InboxView.create = function (controller) {
  var iv = new this();
  iv.controller(controller);
  iv.taskDB(controller.taskDB());
  return iv;
};

InboxView.prototype.detach = function () {
  if (this.taskListView()) {
    this.taskListView().remove();
  }
  if (this.$el) {
    this.$el.remove();
    this.$el = null;
  }
};

InboxView.prototype.remove = function () {
  this.detach();
  if (this.removeTaskDBCreateHandler) {
    this.removeTaskDBCreateHandler();
  }
};

InboxView.prototype.render = function ($dest) {
  this.$el = $('<div class="InboxView">').appendTo($dest);

  this.$status = $('<div class="StatusLine">').appendTo(this.$el);

  this.$listHolder = $('<div class="InboxView-listholder">').appendTo(this.$el);

  this.taskListView(TaskListView.create(this.controller()));
  this.taskListView().viewFactory(_.im(this, function (task) {
    var tv = TaskView.create(this.controller(), task);
    tv.showSubtasks(true);
    return tv;
  }));
  this.taskListView().oldTaskViewFilter(function (tv) {
    return tv.task().parent() === null;
  }).insertionFunction(_.im(this, function (task, after) {
    if (task.parent() === null) {
      for (var i = 0; i < this._inboxtasks.length; i++) {
        if (this._inboxtasks[i] === task) {
          this._inboxtasks.splice(i, 1);
          break;
        }
      }
    } else {
      task.detachParent();
    }
    if (after === void 0) {
      task.sort_order(firstSortOrder(this._inboxtasks));
    } else {
      task.sort_order(afterSortOrder(this._inboxtasks, after));
    }
    this._inboxtasks.push(task);
    correctSortOrder(this._inboxtasks);
  }));
  this.taskListView().render(this.$listHolder);

};

InboxView.prototype.refresh = function (/*opt*/sweep) {
  this.refreshTimeout = null;

  if (sweep) {
    this.taskListView().clear();
  }

  this._inboxtasks = this.controller().taskDB().getInbox();
  correctSortOrder(this._inboxtasks);

  this.$status.text(pluralize(this._inboxtasks.length, "task"));

  this.taskListView().updateSubtasks(this._inboxtasks);
};

InboxView.prototype.hashArgument = function (arg) {
  this.refresh();
};

function ProjectsView() {
  this._taskDB = null;
  this._controller = null;
  this._projectListView = null;
  this._taskListView = null;
  this._activeProject = null;
}

addAccessors(ProjectsView, [
  "!controller", "!projectListView", "!taskListView", "!activeProject"
]);

ProjectsView.prototype.taskDB = function (/*opt*/taskDB) {
  if (arguments.length > 0) {
    this._taskDB = taskDB;
    if (this.removeTaskDBCreateHandler) {
      this.removeTaskDBCreateHandler();
    }
    this.removeTaskDBCreateHandler = taskDB.events.on("created updated", _.im(this, "taskCreated"));
    return this;
  } else {
    return this._taskDB;
  }
};

ProjectsView.prototype.taskCreated = function (task) {
  if (!this.refreshTimeout) {
    this.refreshTimeout = window.setTimeout(_.im(this, "refresh"), 0);
  }
};

ProjectsView.create = function (controller) {
  var iv = new this();
  iv.controller(controller);
  iv.taskDB(controller.taskDB());
  return iv;
};

ProjectsView.prototype.detach = function () {
  if (this.taskListView()) {
    this.taskListView().remove();
  }
  if (this.projectListView()) {
    this.projectListView().remove();
  }
  if (this.$el) {
    this.$el.remove();
    this.$el = null;
  }
};

ProjectsView.prototype.remove = function () {
  this.detach();
  if (this.removeTaskDBCreateHandler) {
    this.removeTaskDBCreateHandler();
  }
};

ProjectsView.prototype.render = function ($dest) {
  this.$el = $('<div class="ProjectsView">').appendTo($dest);

  this.$projectListArea = $('<div class="ProjectsView-plist">').appendTo(this.$el);
  this.$projectTaskArea = $('<div class="ProjectsView-ptask">').appendTo(this.$el);

  this.$status = $('<div class="StatusLine">').appendTo(this.$projectTaskArea);

  this.projectListView(TaskListView.create(this.controller()));
  this.projectListView()
    .viewFactory(_.im(this, function (task) {
      var tv = ProjectTaskView.create(this.controller(), task);
      tv.click(_.im(this, function (task) {
        window.location.hash = "#projects/" + task.id();
      }));
      return tv;
    }))
    .oldTaskViewFilter(function (tv) {
      return false;
    })
    .insertionFunction(_.im(this, function (task, after) {
      if (task.parent() === null) {
        for (var i = 0; i < this._projects.length; i++) {
          if (this._projects[i] === task) {
            this._projects.splice(i, 1);
            break;
          }
        }
      } else {
        task.detachParent();
      }
      if (!task.project_type()) { task.project_type("parallel"); }
      if (after === void 0) {
        task.sort_order(firstSortOrder(this._projects));
      } else {
        task.sort_order(afterSortOrder(this._projects, after));
      }
      this._projects.push(task);
      correctSortOrder(this._projects);
    }));

  this.projectListView().render(this.$projectListArea);

  this.taskListView(TaskListView.create(this.controller()));
  this.taskListView()
    .viewFactory(_.im(this, function (task) {
      var tv = TaskView.create(this.controller(), task);
      tv.showSubtasks(true);
      return tv;
    }))
    .oldTaskViewFilter(_.im(this, function (tv) {
      return false;
    }));
  var $taskListHolder = $('<div class="ProjectsView-listholder">').appendTo(this.$projectTaskArea);
  this.taskListView().render($taskListHolder);
  this.$createTask = $('<div class="ProjectsView-createTask">+ task</div>').appendTo($taskListHolder);
  this.$createTask.hide();

  this.$createTask.on("click", _.im(this, function (e) {
    e.preventDefault();
    if (this.activeProject()) {
      var task = this.controller().taskDB().createTask();
      this.controller().taskSelectionController().createdTask(task);
      this.activeProject().addSubtask(task);
    }
  }));
};

ProjectsView.prototype.refresh = function (/*opt*/sweep) {
  this.refreshTimeout = null;
  
  if (sweep) {
    this.taskListView().clear();
  }

  this._projects = this.taskDB().getProjects();
  correctSortOrder(this._projects);
  this.projectListView().updateSubtasks(this._projects);

  if (this.activeProject()) {
    this.taskListView().updateSubtasks([this.activeProject()]);

    var activeId = this.activeProject().id();
    this.$projectListArea.find("[data-project-id]").each(function () {
      $(this).toggleClass("active", $(this).attr("data-project-id") === activeId);
    });

    this.$status.text(pluralize(0, "task"));
    this.$createTask.show();
  } else {
    this.taskListView().updateSubtasks([]);
    this.$status.text("");
    this.$createTask.hide();
  }
};

ProjectsView.prototype.hashArgument = function (arg) {
  var oarg = arg;
  if (!arg && this.activeProject() && this.activeProject().project_type()) {
    arg = this.activeProject().id();
  }
  if (_.has(this.controller().taskDB()._id_to_task, arg)) {
    this.activeProject(this.controller().taskDB()._id_to_task[arg] || null);
  }
  if (arg && !this.activeProject()) {
    window.location.hash = "projects";
    return;
  }
  if (arg && !oarg) {
    window.location.hash = "projects/" + arg;
    return;
  }
  this.refresh();
  console.log(arg);
};


function DragController() {
  this._draggedTasks = null;
  new EventSystem(this, "dragstart dragend");
}
addAccessors(DragController, [
  "!draggedTasks"
]);

DragController.prototype.startDrag = function (tasks) {
  this.draggedTasks(tasks);
  this.events.notify("dragstart");
};
DragController.prototype.endDrag = function () {
  this.draggedTasks(null);
  this.events.notify("dragend");
};

function TaskSelectionController() {
  this._selectedTasks = [];
  this._createdTask = null;
}
addAccessors(TaskSelectionController, [
  "!createdTask"
]);
TaskSelectionController.prototype.isCreatedTask = function (task) {
  if (task && task === this.createdTask()) {
    this.createdTask(null);
    return true;
  } else {
    return false;
  }
};

TaskSelectionController.prototype.selection = function () {
  return this._selectedTasks;
};
TaskSelectionController.prototype.clearSelection = function () {
  _.invoke(this._selectedTasks, "controllerUnselect");
  this._selectedTasks.length = 0;
  return this;
};
TaskSelectionController.prototype.setSelection = function (task) {
  this.clearSelection().addToSelection(task);
  return this;
};
TaskSelectionController.prototype.addToSelection = function (task) {
  if (!_.contains(this._selectedTasks, task)) {
    this._selectedTasks.push(task);
    task.controllerSelect();
  }
  return this;
};
TaskSelectionController.prototype.removeFromSelection = function (task) {
  for (var i = 0; i < this._selectedTasks.length; i++) {
    if (this._selectedTasks[i] === task) {
      task.controllerUnselect();
      this._selectedTasks.splice(i, 1);
      break;
    }
  }
  return this;
};
TaskSelectionController.prototype.toggleSelection = function (task) {
  if (_.contains(this._selectedTasks, task)) {
    return this.removeFromSelection(task);
  } else {
    return this.addToSelection(task);
  }
};
TaskSelectionController.prototype.selectionOn = function (task) {
  if (!_.contains(this._selectedTasks, task)) {
    this.setSelection(task);
  }
  return this;
};

function ViewOptionsController() {
  this._projectCompletedItems = false;
}

function MainController() {
  this._taskDB = null;
  this._synchronizer = null;
  this._dragController = null;
  this._taskSelectionController = null;
  this._projectSelector = null;
  this._taskSettingsSelector = null;
  this._globalKeyHandler = null;
}
addAccessors(MainController, [
  "!taskDB", "!synchronizer", "!dragController", "!taskSelectionController",
  "!projectSelector", "!taskSettingsSelector", "!globalKeyHandler"
]);

function MainLayoutManager($container, controller) {
  this.defaultView = "inbox";
  this.$container = $container;
  this.controller = controller;

  this.views = {};
  this.activeView = null;

  this.viewLoaders = {
    "inbox" : function () {
      return InboxView.create(controller);
    },
    "projects" : function () {
      return ProjectsView.create(controller);
    },
  };

  $(window).on("hashchange", _.im(this, "handleHashChange"));
  this.handleHashChange();
}
MainLayoutManager.prototype.handleHashChange = function () {
  var hash = window.location.hash.slice(1);
  if (!hash) {
    window.location.hash = this.defaultView;
    return;
  }
  var hashparts = hash.split('/');
  this.activate(hashparts[0], hashparts.slice(1).join('/'));
};

MainLayoutManager.prototype.activate = function (viewname, args) {
  if (!_.has(this.viewLoaders, viewname)) {
    viewname = this.defaultView;
    window.location.hash = viewname;
    return;
  }
  if (!_.has(this.views, viewname)) {
    this.loadView(viewname);
  }

  $("#navigation .navitem").each(function () {
    $(this).toggleClass("selected", $(this).attr('data-dest') === viewname);
  });
  this.controller.taskSelectionController().clearSelection();

  _.each(this.views, function (view, name) {
    if (name === viewname) {
      view.panel.show();
      this.activeView = view;
    } else {
      view.panel.hide();
    }
  }, this);
  this.activeView.view.hashArgument(args);
};
MainLayoutManager.prototype.loadView = function (viewname) {
  var view = this.viewLoaders[viewname]();
  var panel = $('<div class="main_panel">').appendTo(this.$container);
  this.views[viewname] = {
    name : viewname, view : view, panel : panel
  };
  view.render(panel);
};

MainLayoutManager.prototype.doAction = function (action) {
  if (action === "create_task") {
    this.controller.taskDB().createTask();
  } else if (action === "refresh") {
    this.controller.synchronizer().receive();
    this.activeView.view.refresh(true);
  }
};

function UserInfo() {
  this.contextMenu = null;
}
UserInfo.prototype.render = function ($userinfo) {
  this.$userinfo = $userinfo;
  this.contextMenu = new ContextMenu();
  this.contextMenu.render();
  var $ul = $('<ul>').appendTo(this.contextMenu.$el);
  var $signOut = $('<li>Sign out</li>').appendTo($ul);

  $signOut.on("click", _.im(this, function (e) {
    window.location = "/signout";
  }));
  
  this.$userinfo.on("click contextmenu", _.im(this, function (e) {
    e.preventDefault();
    this.contextMenu.activate(this.$userinfo, "vertical");
  }));
};

$(function () {

  $(".navitem").on("click", function (e) {
    if (e.which === 1) {
      e.preventDefault();
      window.location.hash = $(e.target).closest('[data-dest]').attr('data-dest');
    }
  });
  $(".navitem[accent-color]").each(function () {
    var $this = $(this);
    $this.children(".navlabel").css("border-left-color", $this.attr("accent-color"));
  });

  new UserInfo().render($('.UserInfo'));

  var tdb = new TaskDatabase();
  var synchronizer = new DatabaseSynchronizer();
  synchronizer.taskDB(tdb);
  synchronizer.receive();

  window.tdb = tdb;

  var controller = new MainController();
  controller.taskDB(tdb);
  controller.synchronizer(synchronizer);
  controller.dragController(new DragController());
  controller.taskSelectionController(new TaskSelectionController());

  controller.projectSelector(ProjectSelector.create(controller).render());
  controller.taskSettingsSelector(TaskSettingsSelector.create(controller).render());

  controller.globalKeyHandler(new GlobalKeyHandler({
  }));

  $('.navitem').each(function (i) {
    var key = 'M-' + (i+1);
    var dest = $(this).attr("data-dest");
    controller.globalKeyHandler().globalKeyMap[key] = function (e) {
      e.preventDefault();
      window.location.hash = dest;
    };
  });


  window.controller = controller;

  var mlm = new MainLayoutManager($('#main'), controller);
window.mlm= mlm;

  $("#header [data-action]").on("click", function (e) {
    e.preventDefault();
    if (e.which === 1) {
      mlm.doAction($(e.target).closest('[data-action]').attr('data-action'));
    }
  });

//  var inboxView = InboxView.create(controller);
//  inboxView.render($("#main"));

//  inboxView.refresh();

});