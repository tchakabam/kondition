# kondition

A chained async condition assertion runner. Checks expectations on variables against actions and enables conditional waiting.

`kondition` is a bit like playing domino. Every state has to match the condition we assert in order to trigger the next action, which lead to the next state which will be asserted, etc .... Check the example!

Example:

```
// just some typical async test function for an object called "player"
var MyPlayerTestFunction = function(player, done) {

      // we want to look at two things here - the player position and its state.

      // initialize the position CondVar (we need to wrap the "action object" 
      // that will trigger events to update this variable
      
  var positionCondVar = new Runner.CondVar(player, 10000)
      .plug('positionChange').debug(),

      // same for the state. debug() is so we get a print off the values on console
      
      stateCondVar = new Runner.CondVar(player)
      .plug('stateChange').debug(),

      // here we build our domino chain... note that we can even wait for a bit if we want
      // and continue checking the next condition "later"
      
      chain = new Runner.ExpectationChain(player)
      .add(stateCondVar.expectEqual, States.IDLE, "should start in IDLE")
      .add(stateCondVar.expectEqual, States.LOADING, "should go to LOADING when we press play", player.play)
      .add(stateCondVar.expectEqual, States.PLAYING, "should go to PLAYING after LOADING")
      .add(positionCondVar.expectAbove, 5000, "should play until 5000 ms at least")
      .add(stateCondVar.expectEqual, States.SEEKING, "should go to SEEKING when we seek", player.seek, 30000)
      .add(stateCondVar.expectEqual, States.PLAYING, "should go to PLAYING after seeking")
      .add(positionCondVar.expectAbove, 35000, "should play until 35000 ms after seeking")
      .add(stateCondVar.expectEqual, States.PAUSED, "should go to PAUSED when we pause", player.pause)
      .add(stateCondVar.wait(), 5000, "should wait for 5000 ms")
      .add(stateCondVar.unexpect, States.LOADING, "should not be in LOADING state after waiting")
      .add(stateCondVar.expectEqual, States.PAUSED, "should still be in PAUSED state after waiting")
      .add(stateCondVar.expectEqual, States.SEEKING, "should go to SEEKING when we seek", player.seek, 3000)
      .add(stateCondVar.expectEqual, States.PAUSED, "should go to PAUSED after seeking in paused state")
      .add(positionCondVar.expectEqual, 3000, "should be paused at 3000 ms exactly")
      .add(stateCondVar.expectEqual, States.PLAYING, "should go to PLAYING when we play", player.play)
      .add(positionCondVar.expectAbove, 7000, "should play until 7000 ms at least")
      
      // at the end we can call the "done" function (optional) to indicate our top-level runner
      // we are done with this async test.
      
      .end(done);

  // trigger an initial propagation of state var
  
  player.trigger('stateChange', player.getState(), player);

  // push the first domino stone
  
  chain.shift();
}
```
