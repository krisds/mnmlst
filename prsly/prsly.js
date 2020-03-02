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
    let position = 0
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

  // ### Streams backed by lists
  //
  // While parsing text is the common case, really any stream can become a valid
  // input. Do you have a list of data from which you want to extract some
  // structure ? Then turn that list into a stream:
  function from_list(list) {
    let position = 0
    return function() {
      if (position < list.length) return list[position++]
      else return null
    }
  }

  // --------------------------------------------------------------------------
  // **Test**
  //
  {
    let data_stream = new Stream(from_list([ 1, 'two', { a: 3 } ]))
    assert(data_stream.head() === 1)
    assert(data_stream.tail().head() === 'two')
    assert(data_stream.tail().tail().head().a === 3)
    assert(data_stream.tail().tail().tail().head() == null)
    assert(data_stream.head() === 1)
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
  // quick assertions of inputs versus parsers.
  function assert_that(input) {
    // We'll allow strings to be passed in directly, and handle creating the
    // stream for it ourselves.
    if (typeof input === 'string' || input instanceof String)
      input = new Stream(from_string(input))
    
    return {
      // This version is for the simplest assertion: that the given parser
      // should return a match on the input.
      matches: parser => {
        let [stream, value] = parser(input)
        assert(stream != NO_MATCH)
        return { with_value: (f) => f(value) }
      },
      // This assertion is stronger: the given parser should match **all** of
      // the input.
      is_a_valid: parser => {
        let [stream, value] = parser(input)
        assert(stream != NO_MATCH && stream.head() == null)
        return { with_value: (f) => f(value) }
      },
      // This asserts the inverse: that a given parser will not match.
      does_not_match: parser => {
        let [stream, value] = parser(input)
        assert(stream == NO_MATCH)
      },
      // And again a stronger version which disallows partial matches.
      is_not_a_valid: parser => {
        let [stream, value] = parser(input)
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
    
    // Does this parser match a valid input ?
    assert_that('a'  ).matches(letter_a).with_value(equal_to('a'))
    // Does it match the input in full ?
    assert_that('a'  ).is_a_valid(letter_a).with_value(equal_to('a'))

    // Let's make the difference entirely clear: this first assertion shows
    // that a parser need not match the full input.
    assert_that('aaa').matches(letter_a).with_value(equal_to('a'))

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
  // prefer a [fluent interface](https://en.wikipedia.org/wiki/Fluent_interface)
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
  
  // ### Parsing literals
  //
  // You can probably guess that matching literals will be a common thing to
  // want to do. We will definitely be doing plenty of that in our tests. So
  // let's make a dedicated function to specify these.
  function literal(expected) {
    return is(actual => actual == expected)
  }

  // --------------------------------------------------------------------------
  // **Test**
  //
  {
    assert_that('a').is_a_valid(literal('a')).with_value(equal_to('a'))
    // Let's try a whole bunch !
    'abcdefghijklmnopqrstuvwxyz01234567898?!'.split('').forEach(c => {
      assert_that(c).is_a_valid(literal(c)).with_value(equal_to(c))
    })
    
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
    let starting_with_a = sequence(literal('a').as(a => 'A'), any)
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
    let repeating_letter_a = many(literal('a'))
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
    let a_or_b = choice(literal('a'), literal('b'))
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
    let maybe_a = optional(literal('a'))
    assert_that('a').is_a_valid(maybe_a).with_value(equal_to('a'))
    assert_that('' ).is_a_valid(maybe_a).with_value(equal_to(NO_VALUE))
    assert_that('b').is_not_a_valid(maybe_a)
  }
  // --------------------------------------------------------------------------

  // ### Matching the end of an input
  //
  // So far our tests have made sure we're always matching the full input. But
  // we can just as easily set up a parser which does this for us.
  let at_end = as_fluent_parser(stream => {
    if (stream.head() == null)
      return [stream, NO_VALUE]
    else
      return [NO_MATCH, NO_VALUE]
  })
  
  // --------------------------------------------------------------------------
  // **Test**
  //
  {
    let letter_e = literal('e')
    let final_e = sequence(letter_e, at_end)
   
    assert_that('e'    ).matches(letter_e).with_value(equal_to('e'))
    assert_that('earth').matches(letter_e).with_value(equal_to('e'))

    assert_that('e'    ).matches(final_e).with_value(equal_to('e'))
    assert_that('earth').does_not_match(final_e)
  }
  // --------------------------------------------------------------------------

  // ### Recursive parsing
  //
  // So far the parsers we have defined were either stand-alone (e.g. `is`,
  // `any`, `at_end`) or built-up from other parsers (e.g. `optional`,
  // `choice`). But what if a parser needs to reference itself ?
  //
  // Let's take the task of having to parse strings of nested parentheses. So
  // we want to match an open parenthesis, then possibly many other nested
  // parentheses, and finally a closing parenthesis. Basically something like:
  //
  // ```nested = sequence( '(', many(nested), ')' )```
  //
  // As you can see, the parser would like to reference itself. But that is
  // currently not possible until that parser has been built...
  //
  // The solution is to allow declaring a parser before fully defining it. That
  // is what the following function allows. It will return a parser whose
  // internals can be defined in a later step.
  function to_be_defined() {
    let parser = none
    
    let fluent = as_fluent_parser(stream => parser(stream))
    
    fluent.define = function(actual_parser) {
      parser = actual_parser
      return fluent
    }
    
    return fluent
  }
  
  // --------------------------------------------------------------------------
  // **Test**
  //
  // So, now that we can, let's define a parser for nested parentheses.
  {
    let parens = to_be_defined()
    let open   = literal('(')
    let close  = literal(')')
    parens.define(sequence(open, many(parens), close))
    
    assert_that('('     ).is_a_valid(open)
    assert_that(')'     ).is_a_valid(close)
    assert_that('()'    ).is_a_valid(parens)
    assert_that('(())'  ).is_a_valid(parens)
    assert_that('(()())').is_a_valid(parens)

    assert_that('('     ).is_not_a_valid(parens)
    assert_that(')'     ).is_not_a_valid(parens)
    assert_that('(()'   ).is_not_a_valid(parens)
    assert_that('(()))' ).is_not_a_valid(parens)
  }
  // --------------------------------------------------------------------------

  // ### Skipping parts of the stream while matching
  //
  // It might be an odd idea to want a parser to ignore parts of some input,
  // but it proves to be a useful thing at times. Maybe you're only interested
  // in certain elements of your input. Maybe you don't have a good handle on
  // the structure of parts of the input and still want to get going with the
  // parts you do know. Maybe developing a complete parser is just too 
  // expensive or unneccessary. Maybe you're into [island grammars](https://en.wikipedia.org/wiki/Island_grammar).
  // Whatever the reason, skipping may be exactly what you need.
  //
  // So here is a parser which will scan the stream and skip anything up to a
  // predefined point. How do we define that place ? By writing a parser for
  // it, of course !
  function skip_to(parser) {
    return as_fluent_parser(stream => {
      let skipped = []
      let [next, value] = parser(stream)
      
      while (next == NO_MATCH) {
        skipped.push(stream.head())
        stream = stream.tail()
        if (stream == null) break;
        [next, value] = parser(stream)
      }
      
      return [stream, skipped.length > 0 ? skipped : NO_VALUE]
    })
  }
  
  // --------------------------------------------------------------------------
  // **Test**
  //
  {
    let is_a = literal('a')
    let skip_to_a = sequence(skip_to(is_a), is_a)

    assert_that('a'    ).is_a_valid(skip_to_a).with_value(equal_to('a'))
    assert_that('+a'   ).is_a_valid(skip_to_a).with_value(equal_to([['+'], 'a']))
    assert_that('+%$#a').is_a_valid(skip_to_a).with_value(equal_to([['+', '%', '$', '#'], 'a']))

    assert_that(''     ).is_not_a_valid(skip_to_a)
    assert_that('b'    ).is_not_a_valid(skip_to_a)
    assert_that('bcdef').is_not_a_valid(skip_to_a)
  }
  // --------------------------------------------------------------------------
  
  // ### Out-of-sequence parsing
  //
  // Up to this point we have tried to parse everything in one go; starting at
  // the beginning and moving step by step towards the end of the stream. 
  // Sometimes, however, it can be useful to return to return to something in a
  // later step.
  //
  // The example here will try to parse something enclosed between two markers,
  // but it will __first__ look for the markers and __only then__ try to match
  // what was found in between.
  // 
  // Why would you want to do such a thing. Well, scanning for the end marker
  // first may simplify the parser for the intermediate part. Say, for example,
  // that the end marker is two consecutive square brackets (i.e. ']]'), but
  // that single square brackets may still appear before that. Setting that up
  // in-sequence would require catching these cases, and maybe using some form
  // of negation to make sure we don't accidentally consume the end marker in
  // error. By looking for the end marker first we can ignore that complexity
  // by making sure that case won't even show up.
  function enclosed(opening, inner, closing) {
    // We will be using skipping to fast-forward to the closing marker.
    let skip_to_closing = skip_to(closing)
    
    return as_fluent_parser(stream => {
      // Start by matching the opening.
      let [stream_after_opening, value_from_opening] = opening(stream)
      if (stream_after_opening == NO_MATCH) return [NO_MATCH, NO_VALUE]

      // Then skip to the end.
      let [stream_up_to_closing, skipped] = skip_to_closing(stream_after_opening)
      if (stream_up_to_closing == NO_MATCH) return [NO_MATCH, NO_VALUE]

      // Now, skipping returns a list of all values which were skipped.
      // We'll be turning those into a stream and then use that as the source
      // for the inner parser.
      let [stream_after_inner, value_from_inner] = inner(new Stream(from_list(skipped || [])))
      // Here we say that we expect the inner parser to match __all__ of the
      // skipped values.
      if (stream_after_inner == NO_MATCH || stream_after_inner.head() != null) return [NO_MATCH, NO_VALUE]

      // Finally, we match the closing marker.
      let [stream_after_closing, value_from_closing] = closing(stream_up_to_closing)
      
      // And then build and return a value of our own.
      let values = []
      if (value_from_opening != NO_VALUE) values.push(value_from_opening)
      if (value_from_inner != NO_VALUE) values.push(value_from_inner)
      if (value_from_closing != NO_VALUE) values.push(value_from_closing)
      return [stream_after_closing, values]
    })
  }
  
  // --------------------------------------------------------------------------
  // **Test**
  //
  {
    let open  = sequence(literal('['), literal('['))
    let close = sequence(literal(']'), literal(']'))
    let inner = many(any)
    let box = enclosed(open, inner, close)
    
    assert_that('[[]]'   )
      .is_a_valid(box)
      .with_value(equal_to([['[', '['], [], [']', ']']]))
    
    assert_that('[[***]]')
      .is_a_valid(box)
      .with_value(equal_to([['[', '['], ['*', '*', '*'], [']', ']']]))
    
    // Here is the case we mentioned before. Single instances of a closing
    // square bracket are allowed before between the open and close marker.
    assert_that('[[^][^]]')
      .is_a_valid(box)
      .with_value(equal_to([['[', '['], ['^', ']', '[', '^'], [']', ']']]))

    // A sequence of two (or more) square brackets, however, is not.
    assert_that('[[++]]+]]').is_not_a_valid(box)
    // Note that the end marker is the first occurence of two consecutive
    // square brackets. So in this case the final square bracket is considered
    // outside of the "box".
    assert_that('[[--->]]]').is_not_a_valid(box)
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

  // More complex parses might yield arrays of arrays, which we may want
  // flattened.
  function flattened_value(xs) { 
    return xs.reduce((acc, val) => acc.concat(val), [])
  }

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
    from_list: from_list,
    
    NO_MATCH: NO_MATCH,
    NO_VALUE: NO_VALUE,
    is: is,
    literal: literal,
    any: any,
    none: none,
    sequence: sequence,
    many: many,
    choice: choice,
    optional: optional,
    at_end: at_end,
    to_be_defined: to_be_defined,
    skip_to: skip_to,
    enclosed: enclosed,
    
    constant_value: constant_value,
    joined_value: joined_value,
    ignored_value: ignored_value,
    first_value: first_value,
    int_value: int_value,
    flattened_value: flattened_value,
    piped: piped,
    
    assert_that: assert_that,
    equal_to: equal_to
  }
})
