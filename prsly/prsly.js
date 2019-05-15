// # Minimalist Parser Combinators (prsly)
//
// Parsing data into something useful is a common task in applications. And
// there exist a lot of different approaches to doing it. Unfortunately, it may
// also seem quite a hard thing to do. If you've taken any compiler or formal
// languages course you may have had more than your fair share of
// LLALRLALLLRLRL grammar theorems. Which is why it's often tempting to go for
// simple splitting of strings or the copious use of regexes.
//
// But it does not have to be that hard. Parser combinators present a pretty
// straightforward alternative. Rather than relying on state machines and
// decision tables they work by composing mini-parsers into more complete
// solutions.
//
// While parser combinators may lack some of the interesting properties you
// get from formal grammars (such as detection of ambiguities), they are quite
// easy to use and, as we'll see, also very easy to implement.

const assert = require('assert')
define([], function () {

  // ## Streams
  //
  // Before we get into the actual parsing itself we're going to define what
  // exactly we want to parse. And that, in a nutshell, is a stream of values.
  // The typical example, of course, is a sequence of characters making up some
  // text. The characters come in order, and we try to match in some way which
  // makes sense.
  //
  // A stream is basically something which gives us two things: the current
  // value, and a promise for more values. A typical way of stating this is
  // that a stream has a 'head' (the current value) and a 'tail' (all next
  // values). We will be using that same terminology here.
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

  // Laziness is fine, but at some point we need to get work done. The first
  // thing we need is to know which value we're currently looking at. Or, using
  // the terminology from above, what is the "head" ? The first time the Stream
  // is asked this question, it simply calls the generator function and returns
  // the value it gets. But it will also store that value so that any further
  // requests will get the same answer.
  Stream.prototype.head = function() {
    if (this.lazy_head === undefined)
      this.lazy_head = this.generator_fn()

    return this.lazy_head
  }

  // The tail function is very similar to the head. But rather than generating
  // a new value we create a new stream object to represent the remaining 
  // values. This object will also get stored, again so that any further
  // requests will get the same answer.
  //
  // Note that there is one special case we're checking here, and that is the
  // 'end of stream' condition. We assume that the head of a stream must always
  // be a non-null value, unless the stream has ended. In the latter case the
  // tail of the stream will also be null, effectively stating that there are
  // no more values which can be consumed.
  Stream.prototype.tail = function() {
    if (this.lazy_tail === undefined) {
      if (this.head() == null)
        this.lazy_tail = null
      else
        this.lazy_tail = new Stream(this.generator_fn)
    }

    return this.lazy_tail
  }
  
  // ### Streams of characters
  //
  // The most common use case for parsers is to process text, or strings. So
  // our generator function is one which will take a string and break it into
  // individual values for matching. We could choose to split strings by
  // whitespace, but that already assumes some structure of our inputs. Instead
  // we will break strings into individual characters, for maximum flexibility.
  //
  // The following generator function will return each character of a given
  // string in turn.
  function from_string(string) {
    var position = 0
    return function() {
      if (position < string.length) return string.charAt(position++)
      else return null
    }
  }

  // --------------------------------------------------------------------------
  // **Test**
  //
  {
    // We create a stream from the string "abc".
    let abc = new Stream(from_string('abc'))
    // We expect the first value to be 'a'.
    assert(abc.head() === 'a')
    // The next values are 'b' and 'c'.
    assert(abc.tail().head() === 'b')
    assert(abc.tail().tail().head() === 'c')
    // After which we have reached the end of the stream.
    assert(abc.tail().tail().tail().head() == null)
    // Note that while we can progress through the different values of the 
    // stream, as long as we have a reference to a previous step we can replay
    // the stream from there. So we can go back to the first value (or any
    // other) whenever we want.
    assert(abc.head() === 'a')
  }
  // --------------------------------------------------------------------------

  // ## Parser combinators
  //
  // As we hinted at earlier, parser combinators work by defining some very
  // basic parsers, and allowing them to be combined in arbitrary ways. A
  // parser itself is a function which looks at the stream, checks the values
  // it finds, and decides whether those values match what it expects or not.
  // In addition, as we want to be able to get useful data from the parse, it
  // should also return a value representing what it has seen in the stream.
  // Say we have a parser which matches numbers, we would probably want that
  // as an actual integer value.
  //
  // Putting all of that together we can decide the signature of parser
  // functions: `(stream) => [stream, value]`
  //
  // Now, what value should `stream` and `value` have in case the match
  // failed ? Let's define some constants for these:
  let NO_MATCH = null
  let NO_VALUE = undefined
  
  // ### Parsing a single value
  //
  // Time to put this together. The simplest parser is one which tests a
  // single value in the stream and, if the test passed, returns that value
  // as its result as well as the remainder (here: the tail) of the stream.
  function match(test_value_fn) {
    return function(stream) {
      let value = stream.head()
      if (test_value_fn(value))
        return [stream.tail(), value]
      else
        return [NO_MATCH, NO_VALUE]
    }
  }

  // --------------------------------------------------------------------------
  // **Test**
  //
  // We'll be testing lots of parsers against lots of inputs. We'll spend some
  // time here to make that more pleasant. Starting with a means of setting up
  // quick assertions of input strings versus parsers.
  function assert_that(input) {
    return {
      is_a_valid: parser => {
        let [stream, value] = parser(new Stream(from_string(input)))
        assert(stream != NO_MATCH && stream.head() == null)
        return { with_value: (f) => f(value) }
      },
      is_not_a_valid: parser => {
        let [stream, value] = parser(new Stream(from_string(input)))
        assert(stream == NO_MATCH || stream.head() != null)
      }
    }
  }
  
  // And provide a helper function to assert that the returned values match an
  // expected one. The complexity here is to cover comparison of arrays of
  // values, which will be of importance later.
  function equal_to(expected) {
    if (expected == null)
      return (actual) => assert(actual == null)

    else if (expected instanceof Array) 
      return (actual) => {
        assert(actual.length == expected.length)
        for (let i = 0; i < expected.length; i++) 
          equal_to(expected[i])(actual[i])
      }

    else
       return (actual) => assert(actual == expected)
  }

  {
    // This should match a single character 'a', and return that character.
    let letter_a = match(a => a == 'a')
    assert_that('a'  ).is_a_valid(letter_a).with_value(equal_to('a'))
    assert_that('b'  ).is_not_a_valid(letter_a)
    assert_that('abc').is_not_a_valid(letter_a)
  }
  
  // --------------------------------------------------------------------------

  // This is fine, but we really want to let the user have the ability to
  // remap that value to something which is of use to him or her.
  function as(parser, mapping_fn) {
    return function(stream) {
      let [next, value] = parser(stream)
      if (next === NO_MATCH || value === NO_VALUE)
        return [next, NO_VALUE]
      else
        return [next, mapping_fn(value)]
    }
  }

  // This is actually already an example of a parser combinator. It doesn't
  // change the parsing, but it does change the value returned by another
  // parser.

  // --------------------------------------------------------------------------
  // **Test**
  //
  {
    let letter_a_as_A = as(match(a => a == 'a'), a => 'A')
    assert_that('a' ).is_a_valid(letter_a_as_A).with_value(equal_to('A'))
    assert_that('b' ).is_not_a_valid(letter_a_as_A)
    assert_that('aa').is_not_a_valid(letter_a_as_A)
    assert_that('ab').is_not_a_valid(letter_a_as_A)
    assert_that('ba').is_not_a_valid(letter_a_as_A)
  }
  // --------------------------------------------------------------------------
  
  // Now, the following isn't really necessary, but I want something more
  // readable than e.g. ``as(match(date_time), to_date_time_value)``. I would
  // prefer a (fluent interface)[https://en.wikipedia.org/wiki/Fluent_interface]
  // and instead write ``date_time.as(date_time_value)``. To that end we will
  // create a function which takes a parser function and wraps it as needed.
  function as_fluent_parser(parser) {
    let value_fn = (a => a)
    let fluent_parser = as(parser, value => value_fn(value))
    
    fluent_parser.as = function(user_value_fn) {
      value_fn = user_value_fn
      return fluent_parser
    }
    
    return fluent_parser
  }

  // With that let's make the final version of our parser combinators which
  // tests a single value in the stream.
  function is(test_value_fn) {
    return as_fluent_parser(match(test_value_fn))
  }

  // --------------------------------------------------------------------------
  // **Test**
  //
  {
    let letter_a_as_A = is(a => a == 'a').as(a => 'A')
    assert_that('a'  ).is_a_valid(letter_a_as_A).with_value(equal_to('A'))
    assert_that('b'  ).is_not_a_valid(letter_a_as_A)
    assert_that('abc').is_not_a_valid(letter_a_as_A)
  }
  // --------------------------------------------------------------------------
  
  // ### Parsing anything and nothing
  //
  // As simple as matching a single character is matching anything and nothing.
  let any  = is(x => true )
  let none = is(x => false)

  // --------------------------------------------------------------------------
  // **Test**
  //
  {
    assert_that('a').is_a_valid(any)
    assert_that('b').is_a_valid(any)
    
    assert_that('a').is_not_a_valid(none)
    assert_that('b').is_not_a_valid(none)
  }
  // --------------------------------------------------------------------------

  // ### Sequencing parsers
  //
  // Let's see a somewhat more complex example. While matching a single value
  // is useful, we really want to be able to match series of values. This will
  // be a true example of a parser combinator. Given a list of parsers it
  // generates a new one which applies those parsers in order.
  //
  // As you can see, the logic is quite simple. Each parsers forwards the
  // stream according to its own matching. All values returned by these parsers
  // are collected into a list. This is repeated until there are no more
  // parsers, in which case we return the final position of the stream and the
  // list of values, or until one of the parsers fails, in which case we fail
  // as well.
  function sequence() {
    let parsers = Array.prototype.slice.call(arguments, 0)
    return as_fluent_parser(stream => {
      let values = []
      for (let parser of parsers) {
        let [next, value] = parser(stream)
        if (next == NO_MATCH) return [NO_MATCH, NO_VALUE]
        if (value !== NO_VALUE) values.push(value)
        stream = next
      }
    
      return [stream, values]
    })
  }

  // --------------------------------------------------------------------------
  // **Test**
  //
  {
    let starting_with_a = sequence(is(a => a == 'a').as(a => 'A'), any)
    assert_that('ab').is_a_valid(starting_with_a).with_value(equal_to(['A', 'b']))
    assert_that('a1').is_a_valid(starting_with_a).with_value(equal_to(['A', '1']))
    assert_that('ba').is_not_a_valid(starting_with_a)
  }
  // --------------------------------------------------------------------------

  // ### Repeating parsers
  //  
  // If you've made it through the `sequence` combinator then the following one
  // should be a breeze. It generates parsers which apply a given parser as
  // many times as possible. It will return the position of the stream up to
  // point where the given parser no longer matches. If it never matches, then
  // it will just return the beginning position. (If you're familiar with
  // grammars, or regular expressions, you might recognize this as the
  // equivalent of the [Kleene star](http://en.wikipedia.org/wiki/Kleene_star)
  // operator.) In any case, we collect all values returned by the parser into
  // a list again, and return that as well.
  function many(parser) {
    return as_fluent_parser(stream => {
      let values = []
      while (true) {
        let [next, value] = parser(stream)
        if (next == NO_MATCH) return [stream, values]
        if (value !== NO_VALUE) values.push(value)
        stream = next
      }
    })
  }
  
  // --------------------------------------------------------------------------
  // **Test**
  //
  {
    let repeating_letter_a = many(is(a => a == 'a'))
    assert_that('a'  ).is_a_valid(repeating_letter_a).with_value(equal_to(['a']))
    assert_that('aaa').is_a_valid(repeating_letter_a).with_value(equal_to(['a', 'a', 'a']))
    
    assert_that('aab').is_not_a_valid(repeating_letter_a)
    assert_that('b'  ).is_not_a_valid(repeating_letter_a)
  }
  // --------------------------------------------------------------------------
  
  // ### A choice of parsers
  //
  // Another major combinator is one which allows a choice between one or more
  // different alternatives. As soon as one of the alternatives matches, all
  // other alternatives are discarded. This is a major difference from parsers
  // based on formal grammars where the order of alternatives does not really
  // matter. With this combinator the programmer does have to be careful and
  // consider the correct order herself.
  //
  // Interesting side note: if you compare this to the `sequence` combinator
  // you'll see that it is exactly the same, except that the conditions have
  // been reversed.
  function choice() {
    let parsers = Array.prototype.slice.call(arguments, 0)
    return as_fluent_parser(stream => {
      for (let parser of parsers) {
        let [next, value] = parser(stream)
        if (next != NO_MATCH) return [next, value]
      }

      return [NO_MATCH, NO_VALUE]
    })
  }

  // --------------------------------------------------------------------------
  // **Test**
  //
  {
    let a_or_b = choice(is(a => a == 'a'), is(b => b == 'b'))
    assert_that('a').is_a_valid(a_or_b).with_value(equal_to('a'))
    assert_that('b').is_a_valid(a_or_b).with_value(equal_to('b'))
    assert_that('c').is_not_a_valid(a_or_b)
  }
  // --------------------------------------------------------------------------

  // ### Optional parser
  //
  // One more: optional matching. We try to apply the given parser to the
  // stream. If it does not match then we just return the stream at the
  // position we started.
  function optional(parser) {
    return as_fluent_parser(stream => {
      let [next, value] = parser(stream)
      if (next == NO_MATCH) return [stream, NO_VALUE]
      else return [next, value]
    })
  }

  // --------------------------------------------------------------------------
  // **Test**
  //
  {
    let maybe_a = optional(is(a => a == 'a'))
    assert_that('a').is_a_valid(maybe_a).with_value(equal_to('a'))
    assert_that('' ).is_a_valid(maybe_a).with_value(equal_to(NO_VALUE))
    assert_that('b').is_not_a_valid(maybe_a)
  }
  // --------------------------------------------------------------------------

  // ## Mapping values
  //
  // At this point we have all the pieces to construct useful parsers, and we
  // get some raw data from them. However, that data might require some extra
  // steps to become useful. For instance, it might make sense to join
  // individual characters into one big string:
  function joined_value(xs) { return xs.join('') }

  // Maybe we want to first value from a list:
  function first_value(xs) { return xs[0] }

  // Maybe we want a fixed value:
  function constant_value(c) { return x => c }

  // Or none at all:
  function ignored_value(x) { return undefined }

  // We might want to combine different value functions. This function lets you
  // pipe a value through a series of them:
  function piped(...fns) {
    return x => fns.reduce((v, f) => f(v), x)
  }

  // We can then use that to create a function which returns the integer value
  // represented by a series of (assumed numeric) characters:
  let int_value = piped(joined_value, parseInt)

  // ## Wrapping up
  //
  // And that's it. We'll now expose all parsers and combinators to the client,
  // and then we're done.
  return {
    Stream: Stream,
    from_string: from_string,
    
    NO_MATCH: NO_MATCH,
    NO_VALUE: NO_VALUE,
    is: is,
    sequence: sequence,
    many: many,
    choice: choice,
    optional: optional,
    
    constant_value: constant_value,
    joined_value: joined_value,
    ignored_value: ignored_value,
    first_value: first_value,
    int_value: int_value,
    
    assert_that: assert_that,
    equal_to: equal_to
  }
})
