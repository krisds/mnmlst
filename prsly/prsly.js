// # Minimalist Parser Combinators (prsly)
//
// Parsing data into something useful is something which you'll find a lot of
// in applications. It's a pretty ubiquitous thing to have to do, and there a
// lot of different approaches to doing it. Unfortunately, it may also seem
// quite a hard thing to do. If you've taken any compiler or formal languages
// course you may have had more than your fair share of LLALRLALLLRLRL grammar
// theorems. Which is it might seem tempting to go for simple splitting of
// strings and hoping for the best.
//
// But it does not have to be that hard. And parser combinators show this.
// Rather than relying on state machines and decision tables they work by
// composing mini-parsers into more complete solutions.
//
// While parser combinators may lack some of the interesting properties you
// get from formal grammars (such as detection of ambiguities), they are quite
// easy to use and, as we'll see, also very easy to implement.

define([], function () {

  // ## Streams
  //
  // Before we get into the actual parsing itself we're going to define what
  // exactly we're parsing. And that, in a nutshell, are streams of values.
  // The typical example, of course, is a list of characters which make up a
  // file. The characters come in order, and we try to match in some way which
  // makes sense.
  //
  // A stream is basically something which gives us two things: the current
  // value, and then a promise for whatever values follow it. A typical way of
  // stating this is that a stream has a 'head' (the current value) and a
  // 'tail' (all next values). We will be using that same terminology here.
  //
  // For our implementation streams will get built from a generator function
  // provided by the client. This gives the client freedom to work on any kind
  // of stream she wants, as long as she can provide a function which returns
  // the next value. That generator function will get evaluated in a lazy
  // fashion; that is, values will get generated only as needed by the parsers.
  //
  // In addition, our streams will be (semi-) immutable. Once a part of a
  // stream has been generated, those values will no longer change. This will
  // make life much easier when we get to the actual parsers.
  //
  // But enough introduction; let's get to it. Here is the constructor of a
  // stream. Note the lazy members, which are initialized to `undefined` to
  // flag their values have not yet been generated.
  function Stream(generator_fn) {
    this.generator_fn = generator_fn
    this.lazy_head = undefined
    this.lazy_tail = undefined
  }

  // This function will get the head of the stream object. It simply generates
  // the value if needed, and then keeps returning that value upon all 
  // invocations.
  Stream.prototype.head = function() {
    if (typeof this.lazy_head === 'undefined')
      this.lazy_head = this.generator_fn()

    return this.lazy_head
  }

  // The tail function is very similar to the head. But rather than generating
  // a new value we generate a new stream object to represent the rest of the
  // stream. Again, any subsequent invocations will just keep returning that
  // one.
  //
  // Note that there is one special case we're checking here, and that is the
  // 'end of stream' condition. We assume that the head of a stream must always
  // be a non-null value, unless the stream has ended. In the latter case the
  // tail of the stream will also be null, effectively stating that there is no
  // more of the stream which can be consumed.
  Stream.prototype.tail = function() {
    if (typeof this.lazy_tail === 'undefined') {
      if (this.head() == null)
        this.lazy_tail = null
      else
        this.lazy_tail = new Stream(this.generator_fn)
    }

    return this.lazy_tail
  }

  // ## Parser combinators
  //
  // As we hinted at earlier, parser combinators work by defining some very
  // basic ones, and allowing them to be combined in arbitrary ways. One of the
  // simplest parsers is one which matches a single value in the input. So how
  // would we implement such a thing ?
  //
  // The following function generates such a parser based on a matching 
  // function which is provided by the client.
  function is(matching_fn) {
    // The parser itself, as you can see here, is a function which accepts the
    // current stream as an argument. In this case it passes the head of the
    // stream to the matching function. If the matching is successful then it
    // returns the remainder of the stream as a result. If the matching failed
    // then it just returns `null`.
    return function(stream) {
      if (matching_fn(stream.head()))
        return stream.tail()
      else
        return null
    }
  }

  // All upcoming parsers will follow this pattern. Given a stream they apply
  // whatever matching logic is required. If there is a match they return the
  // remainder of the stream after matching. If there is no match they return
  // `null`.
  //
  // So let's see a somewhat more complex example. While matching a single
  // value is useful, we really want to be able to match series of values. This
  // will be our very first example of a parser combinator. Given a list of
  // parsers it generates a new one which applies those parsers in order.
  function sequence() {
    var parsers = Array.prototype.slice.call(arguments, 0)
    return function(stream) {
      // As you can see, the logic is quite simple. Each parsers forwards the
      // stream according to its own matching. This is repeated untill there
      // are no more parsers, in which case we return the final position of the
      // stream, or untill one of the parsers fails, in which case we fail as
      // well.
      for (var i = 0; i < parsers.length; i++) {
        stream = parsers[i](stream)
        if (stream == null) return null
      }
    
      return stream
    }
  }

  // If you've made it through the `sequence` combinator then the following one
  // should be a breeze. It generates parsers which apply a given parser as
  // many times as possible. It will return the position of the stream up to
  // point where the given parser no longer matches. If it never matches, then
  // it will just return the beginning position. (If you're familiar with
  // grammars, or regular expressions, you might recognize this as the
  // equivalent of the [Kleene star](http://en.wikipedia.org/wiki/Kleene_star)
  // operator.)
  function many(parser) {
    return function(stream) {
      while (true) {
        var next = parser(stream)
        if (next == null) return stream
        stream = next
      }
    }
  }

  // Another major combinator is one which allows a choice between one or more
  // different alternatives. As soon as one of the alternatives matches, all
  // other alternatives will no longer be evaluated. This is a major difference
  // from parsers based on formal grammars where the order of alternatives does
  // not really matter. With this combinator the programmer does have to be
  // careful and consider the correct order herself.
  //
  // Interesting side note: if you compare this to the `sequence` combinator
  // you'll see that it is exactly the same, except that the conditions have
  // been reversed.
  function choice() {
    var parsers = Array.prototype.slice.call(arguments, 0)
    return function(stream) {
      for (var i = 0; i < parsers.length; i++) {
        var next = parsers[i](stream)
        if (next != null) return next
      }

      return null
    }
  }

  // One more: optional matching. We try to apply the given parser to the
  // stream. If it does not match then we just return the stream at the
  // position we started.
  function optional(parser) {
    return function(stream) {
      var next = parser(stream)
      if (next != null) return next
      else return stream
    }
  }

  // And that's it. We'll now expose all parsers and combinators to the client,
  // and then we're done.
  return {
    Stream: Stream,
    is: is,
    sequence: sequence,
    many: many,
    choice: choice,
    optional: optional
  }
})
