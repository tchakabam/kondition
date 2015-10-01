module.exports = {};

var DEBUG = true;

function log (msg) {
  if (DEBUG) {
    window.console.log (msg);
  }
}

function bindAll(instance, functions) {
  functions.forEach(function(func) {
    instance[func] = instance[func].bind(instance);
  });
}

var CondVar = module.exports.CondVar = function(actionObject, timeoutMs) {

  if (!actionObject || !actionObject.on || !actionObject.trigger) {
    throw new Error("Need to pass an Observable object to constructor");
  }
  this.actionObject = actionObject;

  this.debugEnabled = false;
  this.reset();
  this.timeoutMs = timeoutMs;

  bindAll(this, [
    'expectBelow',
    'expectAbove',
    'expectEqual',
    'expectEqualAbove',
    'expectDifferent',
    'unexpect'
  ]);
};

CondVar.SIGNAL = '__signal__';
CondVar.NOT_SIGNAL = '__notsignal__';

CondVar.prototype.reset = function() {
  this.equalVal = null;
  this.differentVal = null;
  this.aboveVal = null;
  this.belowVal = null;
  this.aboveEqualVal = null;
  this.notExpectVal = null;
  this.since = null;
  clearTimeout(this.timeout);
};

CondVar.prototype.debug = function() {
  this.debugEnabled = true;
  return this;
};

CondVar.prototype.expectBelow = function(val, since) {
  this.belowVal = val;
  this.updateCheck(since);
};

CondVar.prototype.expectAbove = function(val, since) {
  this.aboveVal = val;
  this.updateCheck(since);
};

CondVar.prototype.expectEqualAbove = function(val, since) {
  this.aboveEqualVal = val;
  this.updateCheck(since);
};

CondVar.prototype.expectEqual = function(val, since) {
  this.equalVal = val;
  this.updateCheck(since);
};

CondVar.prototype.expectDifferent = function(val, since) {
  this.differentVal = val;
  this.updateCheck(since);
};

CondVar.prototype.unexpect = function(val, since) {
  this.notExpectVal = val;
  this.updateCheck(since);
};

CondVar.prototype.updateCheck = function(since) {
  this.since = since;

  if (this.preval) {
    log ("CHECKING PRE-VAL");
    this.check(this.preval);
  }

  if (this.timeoutMs) {
    this.timeout = setTimeout(function() {
      this.since && assert(false, "Condition variable timed out waiting for check: " + this.since);
    }.bind(this), this.timeoutMs);
  }
};

CondVar.prototype.check = function(val) {

  log ('NOW CHECKING: ' + this.since);

  this.preval = val;

  if ((this.equalVal && val === this.equalVal)
    || (this.differentVal && val !== this.differentVal)
    || (this.aboveEqualVal && val >= this.aboveEqualVal)
    || (this.belowVal && val < this.belowVal)
    || (this.aboveVal && val > this.aboveVal)) {
    this.reset();
    this.actionObject.trigger(CondVar.SIGNAL, val);
  }
  if (this.notExpectVal && this.notExpectVal === val) {
    var since = this.since,
        notExpectVal = this.notExpectVal;
    this.reset();
    this.actionObject.trigger(CondVar.NOT_SIGNAL, val, notExpectVal);
    assert.notEqual(val, notExpectVal, "Did not expect this value since: " + since);
  } else if (this.notExpectVal) {
    this.reset();
    this.actionObject.trigger(CondVar.SIGNAL, val);
  }
};

CondVar.prototype.plug = function(event, extractValue) {

  if (!extractValue) {
    extractValue = function() {
      return arguments[0];
    };
  }

  this.actionObject.on(event, function() {
    var val = extractValue.apply(null, arguments);
    if (this.debugEnabled) {
      log(val);
    }
    log ("CHECK UPON EVENT");
    this.check(val);
  }.bind(this));
  return this;
};

CondVar.prototype.wait = function() {
  return function(val, since) {
    setTimeout(function() {
      log ("WAIT DONE");
      this.actionObject.trigger(CondVar.SIGNAL, val);
    }.bind(this), val)
  }.bind(this);
};

var ExpectationChain = module.exports.ExpectationChain = function(actionObject) {
  if (!actionObject || !actionObject.on || !actionObject.trigger) {
    throw new Error("Need to pass an Observable object to constructor");
  }
  this.actionObject = actionObject;

  this.actionObject.on(CondVar.SIGNAL, function(val) {

    log("SIGNAL");

    if(this.isEmpty()) {
      this.finalize();
    }

    this.shift();

  }.bind(this));

  this.actionObject.on(CondVar.NOT_SIGNAL, function(val, notExpectVal) {
    this.finalize();
  }.bind(this));

  this.expectors = [];
  this.values = [];
  this.actions = [];
  this.actionsArgs = [];
  this.explainers = [];
};

// TODO: support unexpected
ExpectationChain.prototype.add = function(expector, value, explain, action) {
  this.expectors.push(expector);
  this.values.push(value);
  this.explainers.push(explain);
  this.actions.push(action);
  this.actionsArgs.push(Array.prototype.slice.call(arguments).slice(4));
  return this;
};

ExpectationChain.prototype.end = function(finalizer) {
  this.finalizer = finalizer;
  return this;
};

ExpectationChain.prototype.finalize = function() {
  if(this.finalizer) {
    this.finalizer();
  }
};

ExpectationChain.prototype.enter = function() {
  this.actionObject.trigger(CondVar.SIGNAL);
};

ExpectationChain.prototype.shift = function() {
  if (this.isEmpty()) {
    return false;
  }

  var explain = this.explainers.shift();

  log("SHIFT: " + explain);

  this.expectors.shift()(this.values.shift(), explain);
  if (!!this.actions[0]) {
    this.actions.shift().apply(this.actionObject, this.actionsArgs.shift());
  } else {
    this.actions.shift();
    this.actionsArgs.shift();
  }
  return true;
};

ExpectationChain.prototype.isEmpty = function() {
  return this.expectors.length === 0;
};
