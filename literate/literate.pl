#!/usr/bin/perl

# # Literate
# 
# This is a minimalist program which takes a [literate program](http://en.wikipedia.org/wiki/Literate_programming)
# and transforms into a [Markdown](http://daringfireball.net/projects/markdown/)
# formatted file.
#
# We'll be working off a simple convention, which is mostly programming
# language agnostic. When writing a literate program we'll expect the literate
# part of it to be defined in comments. We'll only consider single-line
# comments without any form of source code before it. That is, the line can
# only hold a comment, and nothing else.
#
# In addition this program won't do anything Markdown specific other than
# making sure that code ends up in code blocks, and the literate comments get
# uncommented. It is up to the literate programmer to format his text according
# to Markdown syntax conventions.

# ## Setting up

# We'll be using some utility modules. The first makes it easier to collect
# and interpret command line parameters. The second should make for more
# readable and maintainable code.
use Getopt::Long;
use Switch;

# These will be the backing variables for the command line options we're
# supporting. The first one flags whether or not the user has requested help
# to be printed.
$help = 0;
# The following two are used for reading from and writing to named files. We
# default to "standard in" and "standard out", but we'll allow the user to
# override this. (From a minimalist point of view we could even leave this out
# and solely rely on "standard in" and "standard out"; but it's easy enough to
# add.)
$file_in = '';
$file_out = '';
# The final option is the "mode". This basically defined how comments will be
# recognized. E.g. for Java/Javascript like languages we'll be looking for
# occurences of '//'; for Perl this will be '#' instead.
$mode='';

# The [Getopt module](http://perldoc.perl.org/Getopt/Long.html) will take care
# of parsing the command line arguments, but we do have to tell it what to 
# expect. In case something fails (because of bad options) we'll print the
# usage and exit.
GetOptions (
  'help|?' => \$help,
  'in:s' => \$file_in,
  'out:s' => \$file_out,
  'mode:s' => \$mode,
) or usage_and_exit ();

# If the client asked for the help to be printed, we do so and exit the
# program.
if ($help) { usage_and_exit (); }

# In order to work correctly the program needs to know what the correct style
# of comments is it should be detecting. If we're lucky the user will have told
# us via the command line and we can move ahead. If not we will try to
# auto-detect the right mode based on the file extension of the file we're 
# asked to read from, if it was specified.
if ($mode eq '' and $file_in) {
  switch ($file_in) {
    case /\.js$/ { $mode = 'javascript'; }
    case /\.pl$/ { $mode = 'perl'; }
  }
}

# Based on the "mode" we'll now set the right comment marker to look for. In
# case it's an unknown mode we'll default to '//' (personal preference based on
# the languages I use most often).
$comment_marker = '';
switch ($mode) {
  case 'javascript' { $comment_marker = '//'; }
  case 'perl'       { $comment_marker = '#'; }
  else              { $comment_marker = '//'; }
}

# And now for the last step before we can do real processing: preparing the
# input and output streams. As said, we default to "standard in" and "standard
# out", but the user can override this by specifying exact filenames on the
# command line.
$fh_in = 'STDIN';
if ($file_in) {
  open (HANDLE_IN, $file_in) or file_not_found ($file_in);
  $fh_in = 'HANDLE_IN';
}

$fh_out = 'STDOUT';
if ($file_out) {
  open (HANDLE_OUT, ">$file_out") or cannot_open_file ($file_out);
  $fh_out = 'HANDLE_OUT';
}

# ## Marking things down
# 
# The actual processing is most easily expressed by means of a state machine.
# The two most important states are:
$COMMENT = 1;
$CODE = 2;
# These flag whether the line we're on is, you guessed it, a comment or code.
# In addition we'll also need:
$EOF = 3;
# This is because in some cases we may have to do some extra work when having
# reached the end of the file.

# So at the start of the file we don't really know yet what state we're really
# in. However, as it turns out, choosing 'COMMENT' as the initial state works
# just fine.
$current_state = $COMMENT;

# Let's get to the actual state machine then. Every line we read marks a
# transition of the state machine, which keeps running until we have reached
# the end of the file.
while ($current_state ne $EOF) {
  # So the first thing to do is to figure out the next state of the state 
  # machine. This depends entirely on the next line we read from the input
  # stream.
  if ($line = <$fh_in>) {
	# Blank lines are treaded as 'no transition'. The new state is the same as
	# the old state.
    if ($line =~ /^\s*$/) {
      $new_state = $current_state;
    # If we find a comment marker then we transition to 'COMMENT'. As a side
    # effect we'll also remove the comment marker from the line, as we don't
    # want it to be part of the final output.
    } elsif ($line =~ /^\s*${comment_marker}\s(.*)$/) {
      $new_state = $COMMENT;
      $line = "$1\n";
    # If we did not see a blank line or a comment marker we can assume we've
    # found a line of code.
    } else {
      $new_state = $CODE;
    }
  # And, of course, if we did not even read a line of text then we trigger the
  # end-of-file state.
  } else {
    $new_state = $EOF;
  }

  # Now we have to react to the transitions of the state machine. There are
  # only a few transitions which we have to deal in a special way.
  switch($current_state) {
	# When moving from comment to code we need to start a code block in
	# Markdown. Note that we include the mode in this marker, which can be used
	# by Markdown for doing syntax highlights.
    case ($COMMENT) {
      switch($new_state) {
        case ($CODE) {
          print $fh_out ("\n```$mode\n");
        }
      }
    }
    # When moving from code to comments or to the end-of-file, we need to close
    # the Markdown code block again.
    case ($CODE) {
      switch($new_state) {
        case ($COMMENT) {
          print $fh_out ("```\n\n");
        }
        case ($EOF) {
          print $fh_out ("```\n\n");
        }
      }
    }   
  }

  # Almost there. We still need to output the actual line we read. Before we
  # do so we replace all occurences of tabs with a space (each).
  $line =~ s/\t/  /g;
  print $fh_out "$line";

  # And finally, we update the state of the state machine to the new state.
  $current_state = $new_state;
}

# That's it! Time to exit the program and let the user enjoy the results.
exit 0;

# ## Appendix
#
# These are just some utility methods for cleaning up the code. The first one
# prints out the help information.
sub usage_and_exit {
  print STDERR ("Usage: literate.pl [OPTIONS]...\n");
  print STDERR ("Where OPTIONS is one of:\n");
  print STDERR ("  -in FILE   read from FILE rather than STDIN\n");
  print STDERR ("  -out FILE  write to FILE rather than STDOUT\n");
  print STDERR ("  -mode      source code language; e.g. 'javascript', 'perl'\n");
  print STDERR ("  -help      print this message\n");
  print STDERR ("\n");
  exit (0);
}

# And the following handle some common file issues.
sub file_not_found {
  print STDERR ("File not found: $_[0]\n");
  exit (-101);
}

sub cannot_open_file {
  print STDERR ("Cannot open file: $_[0]\n");
  exit (-102);
}
