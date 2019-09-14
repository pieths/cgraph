/* Copyright (c) 2019, Piet Hein Schouten. All rights reserved.
 * Licensed under the terms of the MIT license.
 */
import {logger} from './logger.js'; 
import {parser} from '../src/parser.js';


function testParse()
{
    var stats = { passes: 0, failures: 0 };

    let createErrorString = (input, result, expectedResult) => {
        let string = input + "\n\nResult:\n[";

        let it = result.getIterator();
        while (!it.atEnd())
        {
            let data = it.getData();

            let value = data.value.replace("\t", "\\t");
            value = value.replace(/\r/g, "\\r");
            value = value.replace(/\n/g, "\\n");
            string += `\ttype: "${data.type}", value: "${value}"\n`;

            it.advance();
        }

        string += "]\n\nExpected Result:\n[";

        for (var i=0; i < expectedResult.length; i++)
        {
            let value = expectedResult[i].value.replace("\t", "\\t");
            value = value.replace(/\r/g, "\\r");
            value = value.replace(/\n/g, "\\n");
            string += `\ttype: "${expectedResult[i].type}", value: "${value}"\n`;
        }

        string += "]\n";
        return string;
    };

    let test = (description, input, expectedResult) =>
    {
        let passed = true;

        description = description.replace(/\s{2,}/g, " ");
        description += '\n';

        logger.log("RUNNING TEST: " + description);

        let result = parser.parse(input);
        let it = result.getIterator();

        for (var i=0; i < expectedResult.length; i++)
        {
            if (it.atEnd())
            {
                passed  = false;
                logger.error(createErrorString(input, result, expectedResult));
                break;
            }
            else
            {
                let data = it.getData();
                if ((data.type  != expectedResult[i].type) ||
                    (data.value != expectedResult[i].value))
                {
                    passed = false;
                    logger.error(createErrorString(input, result, expectedResult));
                    break;
                }
            }

            it.advance();
        }

        if (passed && !it.atEnd())
        {
            passed = false;
            logger.error(createErrorString(input, result, expectedResult));
        }

        if (passed) stats.passes++;
        else stats.failures++;
    }

    test(`Empty input should return empty array.`,

         "",
         []);

    test(`Input containing only whitespace should return the whitespace
          followed by command boundaries.`,

         "  \t   \n  \n\r\n ",
         [
             {type: parser.TYPE_TEXT, value: '  \t   '},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: '\n'},
             {type: parser.TYPE_TEXT, value: '  '},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: '\n\r\n'},
             {type: parser.TYPE_TEXT, value: ' '},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Sequential command boundary markers should only return one
          command boundary`,

         "\n\n\r\n\r\n\r\n\n\r\r",
         [
             {type: parser.TYPE_COMMAND_BOUNDARY, value: '\n\n\r\n\r\n\r\n\n\r\r'},
         ]);

    test(`White space is considered part of a text block and is
          passed through as is.`,

         " a b\tc    d \t",
         [
             {type: parser.TYPE_TEXT, value: " a b\tc    d \t"},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    /*
     * LINE CONTINUATION TESTS
     */

    logger.log("--- Line Continuation Tests");

    test(`A command statement can be continued on the next line by placing
          a backslash '\\' immediately at the end of the line. The backslash
          and end of line characters following it are replaced with a single
          space character.`,

         "a\\\r\nb\\\rc\\\nd",
         [
             {type: parser.TYPE_TEXT, value: 'a b c d'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Line continuation with '\\' is greedy. It consumes all end of line
          characters until it finds a character which is not an end of line
          character.`,

         "a\\\r\n\n\n\n\n\r\r\r\n\n\r\n\r\n\r\nb",
         [
             {type: parser.TYPE_TEXT, value: 'a b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Line continuation is not inserted in to the list if it immediately follows
          something other than text.`,

         "(a)\\\nb",
         [
             {type: parser.TYPE_GROUP, value: 'a'},
             {type: parser.TYPE_TEXT, value: ' b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    /*
     * COMMAND BOUNDARY TESTS
     */

    logger.log("--- Command Boundary Tests");

    test(`Command boundaries are delimited by new lines, carriage returns,
          semicolons and the end of the input.`,

         "a;b\nc\r\nd",
         [
             {type: parser.TYPE_TEXT, value: 'a'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ';'},
             {type: parser.TYPE_TEXT, value: 'b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: '\n'},
             {type: parser.TYPE_TEXT, value: 'c'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: '\r\n'},
             {type: parser.TYPE_TEXT, value: 'd'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`There should only be one final command boundary if input ends
          in new line.`,

         "a\n",
         [
             {type: parser.TYPE_TEXT, value: 'a'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: '\n'}
         ]);

    test(`There should only be one final command boundary if input ends
          in carriage return and new line.`,

         "a\r\n",
         [
             {type: parser.TYPE_TEXT, value: 'a'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: '\r\n'}
         ]);

    test(`There should only be one final command boundary if input ends
          in semicolon.`,

         "a;",
         [
             {type: parser.TYPE_TEXT, value: 'a'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ';'}
         ]);

    test(`Multiple command boundary delimiters are combined in to one value.`,

         "a;;\r\n;\n",
         [
             {type: parser.TYPE_TEXT, value: 'a'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ';;\r\n;\n'}
         ]);

    /*
     * GROUP TESTS
     */

    logger.log("--- Group Tests");

    test(`A group is delimited by open and close parenthesis ( ).`,

         "a (group of characters)",
         [
             {type: parser.TYPE_TEXT, value: 'a '},
             {type: parser.TYPE_GROUP, value: 'group of characters'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`An empty group is a group with an empty string as its value.`,

         "a()b",
         [
             {type: parser.TYPE_TEXT, value: 'a'},
             {type: parser.TYPE_GROUP, value: ''},
             {type: parser.TYPE_TEXT, value: 'b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`A group with only whitespace inside of it is a group containing that whitespace.`,

         "a( )b",
         [
             {type: parser.TYPE_TEXT, value: 'a'},
             {type: parser.TYPE_GROUP, value: ' '},
             {type: parser.TYPE_TEXT, value: 'b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Command boundary characters have no special meaning inside of groups.`,

         'a (group; of\n characters\r\n)',
         [
             {type: parser.TYPE_TEXT, value: 'a '},
             {type: parser.TYPE_GROUP, value: 'group; of\n characters\r\n'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`String delimiters have no special meaning inside of groups.`,

         'a ("group" of characters)',
         [
             {type: parser.TYPE_TEXT, value: 'a '},
             {type: parser.TYPE_GROUP, value: '"group" of characters'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Consecutive groups do not get combined in to a single group.`,

         'a (group)(of) characters',
         [
             {type: parser.TYPE_TEXT, value: 'a '},
             {type: parser.TYPE_GROUP, value: 'group'},
             {type: parser.TYPE_GROUP, value: 'of'},
             {type: parser.TYPE_TEXT, value: ' characters'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`If a group is not closed by the end of the input then it is automatically closed.`,

         'this (group of characters',
         [
             {type: parser.TYPE_TEXT, value: 'this '},
             {type: parser.TYPE_GROUP, value: 'group of characters'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`An open parenthesis inside a group has no effect on group processing.`,

         'this (group of (characters) then',
         [
             {type: parser.TYPE_TEXT, value: 'this '},
             {type: parser.TYPE_GROUP, value: 'group of (characters'},
             {type: parser.TYPE_TEXT, value: ' then'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    /*
     * STRING TESTS
     */

    logger.log("--- String Tests");

    test(`A string is delimited by quotes (").`,

         'a "string of characters"',
         [
             {type: parser.TYPE_TEXT, value: 'a '},
             {type: parser.TYPE_STRING, value: 'string of characters'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Command boundary characters have no special meaning inside of strings.`,

         'a "string; of\n characters\r\n"',
         [
             {type: parser.TYPE_TEXT, value: 'a '},
             {type: parser.TYPE_STRING, value: 'string; of\n characters\r\n'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Script or group delimiters have no special meaning inside of strings.`,

         'a "(string) of {characters}"',
         [
             {type: parser.TYPE_TEXT, value: 'a '},
             {type: parser.TYPE_STRING, value: '(string) of {characters}'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Consecutive strings do not get combined in to a single string.`,

         'a "string""of" characters',
         [
             {type: parser.TYPE_TEXT, value: 'a '},
             {type: parser.TYPE_STRING, value: 'string'},
             {type: parser.TYPE_STRING, value: 'of'},
             {type: parser.TYPE_TEXT, value: ' characters'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`If a string is not closed by the end of the input then it is automatically closed.`,

         'this "string of characters',
         [
             {type: parser.TYPE_TEXT, value: 'this '},
             {type: parser.TYPE_STRING, value: 'string of characters'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    /*
     * SCRIPT TESTS
     */

    logger.log("--- Script Tests");

    test(`A script block is delimited by curly braces { } and is passed through as is.`,

         'a {b=3; return b + 1}',
         [
             {type: parser.TYPE_TEXT, value: 'a '},
             {type: parser.TYPE_SCRIPT, value: 'b=3; return b + 1'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`An empty script block is converted to a script item with an empty string
          as its value.`,

         'a{}b',
         [
             {type: parser.TYPE_TEXT, value: 'a'},
             {type: parser.TYPE_SCRIPT, value: ''},
             {type: parser.TYPE_TEXT, value: 'b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Command boundary characters have no special meaning inside of scripts.`,

         'a {a=1; b=2;\n c=3;\r\n return a + b + c;\n}',
         [
             {type: parser.TYPE_TEXT, value: 'a '},
             {type: parser.TYPE_SCRIPT, value: 'a=1; b=2;\n c=3;\r\n return a + b + c;\n'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`String or group delimiters have no special meaning inside of scripts.`,

         'a {a=3; b="this"; if (a >= 3) b = "that"; return b}',
         [
             {type: parser.TYPE_TEXT, value: 'a '},
             {type: parser.TYPE_SCRIPT, value: 'a=3; b="this"; if (a >= 3) b = "that"; return b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);


    test(`If a script block is not closed by the end of the input it is automatically closed`,

         '{a=0; b=1; return a + b;',
         [
             {type: parser.TYPE_SCRIPT, value: 'a=0; b=1; return a + b;'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    /*
     * GROUP SCRIPT TESTS
     */

    logger.log("--- Group Script Tests");

    test(`A group script block is delimited by curly braces { } and is
          surrounded by group items.`,

         'a (group {b=3; return b + 1})',
         [
             {type: parser.TYPE_TEXT, value: 'a '},
             {type: parser.TYPE_GROUP, value: 'group '},
             {type: parser.TYPE_GROUP_SCRIPT, value: 'b=3; return b + 1'},
             {type: parser.TYPE_GROUP, value: ''},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`An empty script block inside a group is creates a group script item
          with an empty string as its value.`,

         'a(b{}c)d',
         [
             {type: parser.TYPE_TEXT, value: 'a'},
             {type: parser.TYPE_GROUP, value: 'b'},
             {type: parser.TYPE_GROUP_SCRIPT, value: ''},
             {type: parser.TYPE_GROUP, value: 'c'},
             {type: parser.TYPE_TEXT, value: 'd'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`String and group delimiters have no special
          meaning inside of a group script.`,

         'a test ({="b"} and {=(a)})',
         [
             {type: parser.TYPE_TEXT, value: 'a test '},
             {type: parser.TYPE_GROUP, value: ''},
             {type: parser.TYPE_GROUP_SCRIPT, value: '="b"'},
             {type: parser.TYPE_GROUP, value: ' and '},
             {type: parser.TYPE_GROUP_SCRIPT, value: '=(a)'},
             {type: parser.TYPE_GROUP, value: ''},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`A script which is not closed inside of a group will
          be automatically closed along with its group container.`,

         'a (group {b=3; return b + 1',
         [
             {type: parser.TYPE_TEXT, value: 'a '},
             {type: parser.TYPE_GROUP, value: 'group '},
             {type: parser.TYPE_GROUP_SCRIPT, value: 'b=3; return b + 1'},
             {type: parser.TYPE_GROUP, value: ''},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`A group which is not closed where the last character is the end
          of a group script will close the group.`,

         'a (group {b=3; return b + 1}',
         [
             {type: parser.TYPE_TEXT, value: 'a '},
             {type: parser.TYPE_GROUP, value: 'group '},
             {type: parser.TYPE_GROUP_SCRIPT, value: 'b=3; return b + 1'},
             {type: parser.TYPE_GROUP, value: ''},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    /*
     * SCRIPT SHORTHAND TESTS
     */

    logger.log("--- Script Shorthand Tests");

    test(`A dollar sign by itself should do nothing.`,

         'a $ b',
         [
             {type: parser.TYPE_TEXT, value: 'a $ b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`An equal sign by itself should do nothing.`,

         'a = b',
         [
             {type: parser.TYPE_TEXT, value: 'a = b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Putting an equal sign in front of text is shorthand for {=$.text}`,

         'a =p1.p b',
         [
             {type: parser.TYPE_TEXT, value: 'a '},
             {type: parser.TYPE_SCRIPT, value: '=$.p1.p'},
             {type: parser.TYPE_TEXT, value: ' b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Putting a dollar sign in front of text is shorthand for {$.text}`,

         'a $p1.p b',
         [
             {type: parser.TYPE_TEXT, value: 'a '},
             {type: parser.TYPE_SCRIPT, value: '$.p1.p'},
             {type: parser.TYPE_TEXT, value: ' b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`An equal sign or dollar sign in the middle of text is not shorthand script.`,

         'a a$p1.p 1=b',
         [
             {type: parser.TYPE_TEXT, value: 'a a$p1.p 1=b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`An equal sign immediately following a command boundary is shorthand.`,

         'a;=p1.p b',
         [
             {type: parser.TYPE_TEXT, value: 'a'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ';'},
             {type: parser.TYPE_SCRIPT, value: '=$.p1.p'},
             {type: parser.TYPE_TEXT, value: ' b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`A dollar sign immediately following a command boundary is shorthand.`,

         'a;$p1.p b',
         [
             {type: parser.TYPE_TEXT, value: 'a'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ';'},
             {type: parser.TYPE_SCRIPT, value: '$.p1.p'},
             {type: parser.TYPE_TEXT, value: ' b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Script shorthand is ended when a ; is encountered.`,

         'a $p1.p;b =p2.p;c',
         [
             {type: parser.TYPE_TEXT, value: 'a '},
             {type: parser.TYPE_SCRIPT, value: '$.p1.p'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ';'},
             {type: parser.TYPE_TEXT, value: 'b '},
             {type: parser.TYPE_SCRIPT, value: '=$.p2.p'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ';'},
             {type: parser.TYPE_TEXT, value: 'c'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Script shorthand is ended when EOL is encountered.`,

         'a $p1.p\nb =p2.p\r\nc',
         [
             {type: parser.TYPE_TEXT, value: 'a '},
             {type: parser.TYPE_SCRIPT, value: '$.p1.p'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: '\n'},
             {type: parser.TYPE_TEXT, value: 'b '},
             {type: parser.TYPE_SCRIPT, value: '=$.p2.p'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: '\r\n'},
             {type: parser.TYPE_TEXT, value: 'c'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Script shorthand is ended when a whitespace character is encountered.`,

         'a $p1.p b =p2.p\tc',
         [
             {type: parser.TYPE_TEXT, value: 'a '},
             {type: parser.TYPE_SCRIPT, value: '$.p1.p'},
             {type: parser.TYPE_TEXT, value: ' b '},
             {type: parser.TYPE_SCRIPT, value: '=$.p2.p'},
             {type: parser.TYPE_TEXT, value: '\tc'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Top level strings can contain any characters.`,

         'a $a=")]}1([{`\'test" =b=\')]}2([{`"test\' $c=`)}]3({[ \'"`',
         [
             {type: parser.TYPE_TEXT, value: 'a '},
             {type: parser.TYPE_SCRIPT, value: '$.a=")]}1([{`\'test"'},
             {type: parser.TYPE_TEXT, value: ' '},
             {type: parser.TYPE_SCRIPT, value: '=$.b=\')]}2([{`"test\''},
             {type: parser.TYPE_TEXT, value: ' '},
             {type: parser.TYPE_SCRIPT, value: '$.c=`)}]3({[ \'"`'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Test creating a arrow function with complex inner code.`,

         'a $f=(x)=>{ let y=3;\nif (x > 2) return x + y;\nelse return M.sin(x) + $.p[\'key\']; } b',
         [
             {type: parser.TYPE_TEXT, value: 'a '},
             {type: parser.TYPE_SCRIPT, value: '$.f=(x)=>{ let y=3;\nif (x > 2) return x + y;\nelse return M.sin(x) + $.p[\'key\']; }'},
             {type: parser.TYPE_TEXT, value: ' b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Test nested delimiters.`,

         'a $f(([]()test[[[]]]{([])})) =g(([]()test[[[]]]{([])})) b',
         [
             {type: parser.TYPE_TEXT, value: 'a '},
             {type: parser.TYPE_SCRIPT, value: '$.f(([]()test[[[]]]{([])}))'},
             {type: parser.TYPE_TEXT, value: ' '},
             {type: parser.TYPE_SCRIPT, value: '=$.g(([]()test[[[]]]{([])}))'},
             {type: parser.TYPE_TEXT, value: ' b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Test strings inside nested delimiters.`,

         'a $f([ ")}]1({[" \')}]2({[\' `)}]3({[` ]) b',
         [
             {type: parser.TYPE_TEXT, value: 'a '},
             {type: parser.TYPE_SCRIPT, value: '$.f([ ")}]1({[" \')}]2({[\' `)}]3({[` ])'},
             {type: parser.TYPE_TEXT, value: ' b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Test using script shorthand for creating a string.`,

         '$a="this is a test"',
         [
             {type: parser.TYPE_SCRIPT, value: '$.a="this is a test"'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Leaving a shorthand script delimiter open will parse to the end of the input.`,

         '=a=([ more stuff after delimiters',
         [
             {type: parser.TYPE_SCRIPT, value: '=$.a=([ more stuff after delimiters'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    /*
     * GROUP SCRIPT SHORTHAND TESTS
     */

    logger.log("--- Group Script Shorthand Tests");

    test(`A dollar sign by itself should do nothing.`,

         '(a $ b)',
         [
             {type: parser.TYPE_GROUP, value: 'a $ b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`An equal sign by itself should do nothing.`,

         '(a = b)',
         [
             {type: parser.TYPE_GROUP, value: 'a = b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Putting an equal sign in front of text is shorthand for {=$.text}`,

         '(a =p1.p b)',
         [
             {type: parser.TYPE_GROUP, value: 'a '},
             {type: parser.TYPE_GROUP_SCRIPT, value: '=$.p1.p'},
             {type: parser.TYPE_GROUP, value: ' b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Putting a dollar sign in front of text is shorthand for {$.text}`,

         '(a $p1.p b)',
         [
             {type: parser.TYPE_GROUP, value: 'a '},
             {type: parser.TYPE_GROUP_SCRIPT, value: '$.p1.p'},
             {type: parser.TYPE_GROUP, value: ' b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`An equal sign or dollar sign in the middle of text is not shorthand script.`,

         '(a a$p1.p 1=b)',
         [
             {type: parser.TYPE_GROUP, value: 'a a$p1.p 1=b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Group script shorthand is ended when a space character is encountered.`,

         '(a $p1.p\r\nb =p2.p\nc $p3.b\t$p4.c)',
         [
             {type: parser.TYPE_GROUP, value: 'a '},
             {type: parser.TYPE_GROUP_SCRIPT, value: '$.p1.p'},
             {type: parser.TYPE_GROUP, value: '\r\nb '},
             {type: parser.TYPE_GROUP_SCRIPT, value: '=$.p2.p'},
             {type: parser.TYPE_GROUP, value: '\nc '},
             {type: parser.TYPE_GROUP_SCRIPT, value: '$.p3.b'},
             {type: parser.TYPE_GROUP, value: '\t'},
             {type: parser.TYPE_GROUP_SCRIPT, value: '$.p4.c'},
             {type: parser.TYPE_GROUP, value: ''},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Script shorthand is ended when ) is encountered. This also ends the group`,

         '(a $p1.p)b',
         [
             {type: parser.TYPE_GROUP, value: 'a '},
             {type: parser.TYPE_GROUP_SCRIPT, value: '$.p1.p'},
             {type: parser.TYPE_GROUP, value: ''},
             {type: parser.TYPE_TEXT, value: 'b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Group script shorthand as the only thing inside a group.`,

         'a($p1.p)b',
         [
             {type: parser.TYPE_TEXT, value: 'a'},
             {type: parser.TYPE_GROUP, value: ''},
             {type: parser.TYPE_GROUP_SCRIPT, value: '$.p1.p'},
             {type: parser.TYPE_GROUP, value: ''},
             {type: parser.TYPE_TEXT, value: 'b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Top level strings can contain any characters.`,

         '(a $a=")]}1([{`\'test" =b=\')]}2([{`"test\' $c=`)}]3({[ \'"`)',
         [
             {type: parser.TYPE_GROUP, value: 'a '},
             {type: parser.TYPE_GROUP_SCRIPT, value: '$.a=")]}1([{`\'test"'},
             {type: parser.TYPE_GROUP, value: ' '},
             {type: parser.TYPE_GROUP_SCRIPT, value: '=$.b=\')]}2([{`"test\''},
             {type: parser.TYPE_GROUP, value: ' '},
             {type: parser.TYPE_GROUP_SCRIPT, value: '$.c=`)}]3({[ \'"`'},
             {type: parser.TYPE_GROUP, value: ''},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Test creating a arrow function with complex inner code.`,

         '(a $f=(x)=>{ let y=3;\nif (x > 2) return x + y;\nelse return M.sin(x) + $.p[\'key\']; } b)',
         [
             {type: parser.TYPE_GROUP, value: 'a '},
             {type: parser.TYPE_GROUP_SCRIPT, value: '$.f=(x)=>{ let y=3;\nif (x > 2) return x + y;\nelse return M.sin(x) + $.p[\'key\']; }'},
             {type: parser.TYPE_GROUP, value: ' b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Test nested delimiters.`,

         '(a $f(([]()test[[[]]]{([])})) =g(([]()test[[[]]]{([])})) b)',
         [
             {type: parser.TYPE_GROUP, value: 'a '},
             {type: parser.TYPE_GROUP_SCRIPT, value: '$.f(([]()test[[[]]]{([])}))'},
             {type: parser.TYPE_GROUP, value: ' '},
             {type: parser.TYPE_GROUP_SCRIPT, value: '=$.g(([]()test[[[]]]{([])}))'},
             {type: parser.TYPE_GROUP, value: ' b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Test strings inside nested delimiters.`,

         '(a $f([ ")}]1({[" \')}]2({[\' `)}]3({[` ]) b)',
         [
             {type: parser.TYPE_GROUP, value: 'a '},
             {type: parser.TYPE_GROUP_SCRIPT, value: '$.f([ ")}]1({[" \')}]2({[\' `)}]3({[` ])'},
             {type: parser.TYPE_GROUP, value: ' b'},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Test using script shorthand for creating a string.`,

         '($a="this is a test")',
         [
             {type: parser.TYPE_GROUP, value: ''},
             {type: parser.TYPE_GROUP_SCRIPT, value: '$.a="this is a test"'},
             {type: parser.TYPE_GROUP, value: ''},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    test(`Leaving a shorthand group script delimiter open will parse to the end of the input.`,

         '(=a=([ more stuff after delimiters',
         [
             {type: parser.TYPE_GROUP, value: ''},
             {type: parser.TYPE_GROUP_SCRIPT, value: '=$.a=([ more stuff after delimiters'},
             {type: parser.TYPE_GROUP, value: ''},
             {type: parser.TYPE_COMMAND_BOUNDARY, value: ''}
         ]);

    logger.log("Completed testing parser.parse");
    logger.log(`Passes:   ${stats.passes}`);
    logger.log(`Failures: ${stats.failures}`);
}


function testParserListIterator()
{
    var stats = { passes: 0, failures: 0 };

    let createErrorString = (list, expectedResult) => {
        let string = "Result:\n[";

        let it = list.getIterator();
        while (!it.atEnd())
        {
            let data = it.getData();

            let value = data.value.replace("\t", "\\t");
            value = value.replace(/\r/g, "\\r");
            value = value.replace(/\n/g, "\\n");
            string += `\ttype: "${data.type}", value: "${value}"\n`;

            it.advance();
        }

        string += "]\n\nExpected Result:\n[";

        for (var i=0; i < expectedResult.length; i++)
        {
            let value = expectedResult[i].value.replace("\t", "\\t");
            value = value.replace(/\r/g, "\\r");
            value = value.replace(/\n/g, "\\n");
            string += `\ttype: "${expectedResult[i].type}", value: "${value}"\n`;
        }

        string += "]\n";
        return string;
    };

    let verifyList = function(list, expectedResult)
    {
        let it = list.getIterator();

        for (var i=0; i < expectedResult.length; i++)
        {
            if (it.atEnd())
            {
                throw createErrorString(list, expectedResult);
            }
            else
            {
                let data = it.getData();
                if ((data.type  != expectedResult[i].type) ||
                    (data.value != expectedResult[i].value))
                {
                    throw createErrorString(list, expectedResult);
                }
            }

            it.advance();
        }

        if (!it.atEnd())
        {
            throw createErrorString(list, expectedResult);
        }
    }

    let verifyIterator = function(it, type, value)
    {
        let data = it.getData();
        let typeMatches = (data.type == type);
        let valueMatches = (data.value == value);

        if (!(typeMatches && valueMatches))
        {
            let errorString = 'Iterator does not match.\n';
            errorString += `Found type (${data.type}) and value: ${data.value}\n`;
            errorString += `Expected type (${type}) and value: ${value}\n`;
            throw errorString;
        }
    }

    let test = (description, func) =>
    {
        description = description.replace(/\s{2,}/g, " ");
        description += '\n';

        logger.log("RUNNING TEST: " + description);

        let result = true;

        try
        {
            func(logger);
        }
        catch (error)
        {
            result = false;
            logger.error(error.toString());
        }

        if (result) stats.passes++;
        else stats.failures++;
    }

    test(
    `Advance() cycles through all the nodes in order.`,
    () => {
        let result = parser.parse('a(b{c}){d}"e"');
        verifyList(result, [
            {type: parser.TYPE_TEXT, value: 'a'},
            {type: parser.TYPE_GROUP, value: 'b'},
            {type: parser.TYPE_GROUP_SCRIPT, value: 'c'},
            {type: parser.TYPE_GROUP, value: ''},
            {type: parser.TYPE_SCRIPT, value: 'd'},
            {type: parser.TYPE_STRING, value: 'e'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);
    });

    test(
    `Cloning an iterator creates a new iterator that points to the same node.`,
    () => {
        let result = parser.parse('a"b"');

        let it = result.getIterator();
        it.advance();

        let it2 = it.clone();

        verifyIterator(it, it2.getData().type, it2.getData().value);

        it2.advance();

        verifyIterator(it, parser.TYPE_STRING, 'b');
        verifyIterator(it2, parser.TYPE_COMMAND_BOUNDARY, '');
    });

    test(
    `The equals() method returns true if the iterators point to the same node
     and false otherwise. `,
    () => {
        let result = parser.parse('a"b"a');

        let it = result.getIterator();
        it.advance();

        let it2 = result.getIterator();
        it2.advance();

        verifyIterator(it, it2.getData().type, it2.getData().value);

        if (!it.equals(it2)) throw 'Iterators are not equal.'

        verifyIterator(it, parser.TYPE_STRING, 'b');
        verifyIterator(it2, parser.TYPE_STRING, 'b');

        it2 = it.clone();
        it2.advance();

        if (it2.equals(it)) throw 'Iterators are equal.';

        /*
         * Verify that the comparison is not based on the type or value.
         */

        it = result.getIterator();
        verifyIterator(it, parser.TYPE_TEXT, 'a');

        it2 = result.getIterator();
        it2.advance();
        it2.advance();
        verifyIterator(it, parser.TYPE_TEXT, 'a');

        if (it.equals(it2)) throw 'Iterators are equal';
    });

    test(
    `The remove() method removes the node which is referenced by the iterator
     from the underlying list. After removal, the iterator is advanced to the
     next element.`,
    () => {
        let result = parser.parse('a"b"');

        let it = result.getIterator();
        it.advance();

        verifyList(result, [
            {type: parser.TYPE_TEXT, value: 'a'},
            {type: parser.TYPE_STRING, value: 'b'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        it.remove();

        verifyList(result, [
            {type: parser.TYPE_TEXT, value: 'a'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        verifyIterator(it, parser.TYPE_COMMAND_BOUNDARY, '');

        it.remove();

        verifyList(result, [
            {type: parser.TYPE_TEXT, value: 'a'},
        ]);

        if (!it.atEnd()) throw 'Iterator not at the end of the list.';
    });

    test(
    `Removing the node from a list which contains only one node results in an empty list.`,
    () => {
        let result = parser.parse('a');

        let it = result.getIterator();

        verifyList(result, [
            {type: parser.TYPE_TEXT, value: 'a'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        it.remove();

        verifyList(result, [
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        it.remove();

        verifyList(result, []);

        if (!it.atEnd()) throw 'Iterator not at the end of the list.';
    });

    test(
    `Removing a node between two text nodes will automatically join the text nodes
     and advance the iterator to the next node.`,
    () => {
        let result = parser.parse('a(b)c');

        verifyList(result, [
            {type: parser.TYPE_TEXT, value: 'a'},
            {type: parser.TYPE_GROUP, value: 'b'},
            {type: parser.TYPE_TEXT, value: 'c'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        let it = result.getIterator();
        it.advance();
        it.remove();

        verifyList(result, [
            {type: parser.TYPE_TEXT, value: 'ac'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        verifyIterator(it, parser.TYPE_COMMAND_BOUNDARY,  '');
    });

    test(
    `Removing a node between two command boundary nodes will automatically
     join the command boundary nodes and advance the iterator to the next node.`,
    () => {
        let result = parser.parse('a;(b);c');

        verifyList(result, [
            {type: parser.TYPE_TEXT, value: 'a'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ';'},
            {type: parser.TYPE_GROUP, value: 'b'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ';'},
            {type: parser.TYPE_TEXT, value: 'c'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        let it = result.getIterator();
        it.advance();
        it.advance();

        verifyIterator(it, parser.TYPE_GROUP, 'b');

        it.remove();

        verifyList(result, [
            {type: parser.TYPE_TEXT, value: 'a'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ';;'},
            {type: parser.TYPE_TEXT, value: 'c'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        verifyIterator(it, parser.TYPE_TEXT, 'c');
    });

    test(
    `Remove the last node from a list.`,
    () => {
        let result = parser.parse('a(b)c');

        verifyList(result, [
            {type: parser.TYPE_TEXT, value: 'a'},
            {type: parser.TYPE_GROUP, value: 'b'},
            {type: parser.TYPE_TEXT, value: 'c'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        let it = result.getIterator();
        it.advance();
        it.advance();
        it.advance();
        it.remove();

        verifyList(result, [
            {type: parser.TYPE_TEXT, value: 'a'},
            {type: parser.TYPE_GROUP, value: 'b'},
            {type: parser.TYPE_TEXT, value: 'c'},
        ]);

        if (!it.atEnd()) throw 'Iterator did not advance to the end.';
    });

    test(
    `Replace a node in a list with a new list. The list that was merged in
     should be invalidated.`,
    () => {
        let list1 = parser.parse('(a);(c)');
        let list2 = parser.parse('(b)');

        verifyList(list1, [
            {type: parser.TYPE_GROUP, value: 'a'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ';'},
            {type: parser.TYPE_GROUP, value: 'c'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        verifyList(list2, [
            {type: parser.TYPE_GROUP, value: 'b'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        let it = list1.getIterator();
        it.advance();

        verifyIterator(it, parser.TYPE_COMMAND_BOUNDARY, ';');

        it.replaceWithList(list2);

        verifyList(list1, [
            {type: parser.TYPE_GROUP, value: 'a'},
            {type: parser.TYPE_GROUP, value: 'b'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
            {type: parser.TYPE_GROUP, value: 'c'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        verifyList(list2, []);

        /*
         * The current node should point to the
         * node that was the head of list 2 .
         */
        verifyIterator(it, parser.TYPE_GROUP, 'b');
    });

    test(
    `Replacing a node in a list with an empty list should just remove the node.`,
    () => {
        let list1 = parser.parse('(a);(c)');
        let list2 = parser.parse('');

        verifyList(list1, [
            {type: parser.TYPE_GROUP, value: 'a'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ';'},
            {type: parser.TYPE_GROUP, value: 'c'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        verifyList(list2, []);

        let it = list1.getIterator();
        it.advance();

        verifyIterator(it, parser.TYPE_COMMAND_BOUNDARY, ';');

        it.replaceWithList(list2);

        verifyList(list1, [
            {type: parser.TYPE_GROUP, value: 'a'},
            {type: parser.TYPE_GROUP, value: 'c'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        /*
         * The current node should point to the next node.
         */
        verifyIterator(it, parser.TYPE_GROUP, 'c');
    });

    test(
    `Replacing the last node in a list should update the tail accordingly.`,
    () => {
        let list1 = parser.parse('(a)');
        let list2 = parser.parse('(b);');

        verifyList(list1, [
            {type: parser.TYPE_GROUP, value: 'a'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        verifyList(list2, [
            {type: parser.TYPE_GROUP, value: 'b'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ';'},
        ]);

        let it = list1.getIterator();
        it.advance();

        verifyIterator(it, parser.TYPE_COMMAND_BOUNDARY, '');

        it.replaceWithList(list2);

        verifyList(list1, [
            {type: parser.TYPE_GROUP, value: 'a'},
            {type: parser.TYPE_GROUP, value: 'b'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ';'},
        ]);

        verifyList(list2, []);

        list1.append(parser.TYPE_TEXT, 'c');

        verifyList(list1, [
            {type: parser.TYPE_GROUP, value: 'a'},
            {type: parser.TYPE_GROUP, value: 'b'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ';'},
            {type: parser.TYPE_TEXT, value: 'c'},
        ]);

        /*
         * The current node should point to the
         * node that was the head of list 2 .
         */
        verifyIterator(it, parser.TYPE_GROUP, 'b');
    });

    test(
    `Replace the first node in a list.`,
    () => {
        let list1 = parser.parse('(a)(c)');
        let list2 = parser.parse('(b)');

        verifyList(list1, [
            {type: parser.TYPE_GROUP, value: 'a'},
            {type: parser.TYPE_GROUP, value: 'c'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        verifyList(list2, [
            {type: parser.TYPE_GROUP, value: 'b'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        let it = list1.getIterator();
        verifyIterator(it, parser.TYPE_GROUP, 'a');

        it.replaceWithList(list2);

        verifyList(list1, [
            {type: parser.TYPE_GROUP, value: 'b'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
            {type: parser.TYPE_GROUP, value: 'c'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        /*
         * The current node should point to the
         * node that was the head of list 2 .
         */
        verifyIterator(it, parser.TYPE_GROUP, 'b');
    });

    test(
    `Replacing a node with a list merges text nodes at the start of the merge.`,
    () => {
        let list1 = parser.parse('a');
        let list2 = parser.parse('b(c)');

        verifyList(list1, [
            {type: parser.TYPE_TEXT, value: 'a'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        verifyList(list2, [
            {type: parser.TYPE_TEXT, value: 'b'},
            {type: parser.TYPE_GROUP, value: 'c'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        let it = list1.getIterator();
        it.advance();
        verifyIterator(it, parser.TYPE_COMMAND_BOUNDARY, '');

        it.replaceWithList(list2);

        verifyList(list1, [
            {type: parser.TYPE_TEXT, value: 'ab'},
            {type: parser.TYPE_GROUP, value: 'c'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        /*
         * The current node should point to the
         * second node in the merged in list because
         * the first node was merged with the previous.
         */
        verifyIterator(it, parser.TYPE_GROUP, 'c');
    });

    test(
    `Replacing a node with a list merges command boundary nodes at the start of the merge.`,
    () => {
        let list1 = parser.parse('a;b(c)');
        let list2 = parser.parse(';d');

        verifyList(list1, [
            {type: parser.TYPE_TEXT, value: 'a'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ';'},
            {type: parser.TYPE_TEXT, value: 'b'},
            {type: parser.TYPE_GROUP, value: 'c'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        verifyList(list2, [
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ';'},
            {type: parser.TYPE_TEXT, value: 'd'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        let it = list1.getIterator();
        it.advance();
        it.advance();
        verifyIterator(it, parser.TYPE_TEXT, 'b');

        it.replaceWithList(list2);

        verifyList(list1, [
            {type: parser.TYPE_TEXT, value: 'a'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ';;'},
            {type: parser.TYPE_TEXT, value: 'd'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
            {type: parser.TYPE_GROUP, value: 'c'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        /*
         * The current node should point to the
         * second node in the merged in list because
         * the first node was merged with the previous.
         */
        verifyIterator(it, parser.TYPE_TEXT, 'd');
    });

    test(
    `Replacing a node with a list merges text nodes at the end of the merge.`,
    () => {
        let list1 = parser.parse('(a)b');
        let list2 = parser.parse('(c)d');

        verifyList(list1, [
            {type: parser.TYPE_GROUP, value: 'a'},
            {type: parser.TYPE_TEXT, value: 'b'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        let it2 = list2.getIterator();
        it2.advance();
        it2.advance();
        it2.remove();

        verifyList(list2, [
            {type: parser.TYPE_GROUP, value: 'c'},
            {type: parser.TYPE_TEXT, value: 'd'},
        ]);

        let it = list1.getIterator();
        verifyIterator(it, parser.TYPE_GROUP, 'a');

        it.replaceWithList(list2);

        verifyList(list1, [
            {type: parser.TYPE_GROUP, value: 'c'},
            {type: parser.TYPE_TEXT, value: 'db'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        /*
         * The current node should point to the
         * start of the merged in list.
         */
        verifyIterator(it, parser.TYPE_GROUP, 'c');
    });

    test(
    `Replacing a node with a list merges command boundary nodes at the end of the merge.`,
    () => {
        let list1 = parser.parse('(a)b;c');
        let list2 = parser.parse('d');

        verifyList(list1, [
            {type: parser.TYPE_GROUP, value: 'a'},
            {type: parser.TYPE_TEXT, value: 'b'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ';'},
            {type: parser.TYPE_TEXT, value: 'c'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        verifyList(list2, [
            {type: parser.TYPE_TEXT, value: 'd'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        let it = list1.getIterator();
        it.advance();
        verifyIterator(it, parser.TYPE_TEXT, 'b');

        it.replaceWithList(list2);

        verifyList(list1, [
            {type: parser.TYPE_GROUP, value: 'a'},
            {type: parser.TYPE_TEXT, value: 'd'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ';'},
            {type: parser.TYPE_TEXT, value: 'c'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        /*
         * The current node should point to the
         * start of the merged in list.
         */
        verifyIterator(it, parser.TYPE_TEXT, 'd');
    });

    test(
    `Replacing a node with a list merges text nodes at both ends of the merge.`,
    () => {
        let list1 = parser.parse('a(b)c(d)');
        let list2 = parser.parse('e');

        verifyList(list1, [
            {type: parser.TYPE_TEXT, value: 'a'},
            {type: parser.TYPE_GROUP, value: 'b'},
            {type: parser.TYPE_TEXT, value: 'c'},
            {type: parser.TYPE_GROUP, value: 'd'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        let it2 = list2.getIterator();
        it2.advance();
        it2.remove();

        verifyList(list2, [
            {type: parser.TYPE_TEXT, value: 'e'},
        ]);

        let it = list1.getIterator();
        it.advance();
        verifyIterator(it, parser.TYPE_GROUP, 'b');

        it.replaceWithList(list2);

        verifyList(list1, [
            {type: parser.TYPE_TEXT, value: 'aec'},
            {type: parser.TYPE_GROUP, value: 'd'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        verifyIterator(it, parser.TYPE_GROUP, 'd');
    });

    test(
    `Replacing a node with a list merges command boundary nodes at both ends of the merge.`,
    () => {
        let list1 = parser.parse(';(b)\n(d)');
        let list2 = parser.parse('e\r');

        verifyList(list1, [
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ';'},
            {type: parser.TYPE_GROUP, value: 'b'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: '\n'},
            {type: parser.TYPE_GROUP, value: 'd'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        let it2 = list2.getIterator();
        it2.remove();

        verifyList(list2, [
            {type: parser.TYPE_COMMAND_BOUNDARY, value: '\r'},
        ]);

        let it = list1.getIterator();
        it.advance();
        verifyIterator(it, parser.TYPE_GROUP, 'b');

        it.replaceWithList(list2);

        verifyList(list1, [
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ';\r\n'},
            {type: parser.TYPE_GROUP, value: 'd'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        verifyIterator(it, parser.TYPE_GROUP, 'd');
    });

    test(
    `trimEnd does nothing if the list is empty.`,
    () => {
        let list = parser.parse('');

        verifyList(list, []);

        list.trimEnd(parser.TYPE_COMMAND_BOUNDARY);

        verifyList(list, []);
    });

    test(
    `trimEnd removes that last node from the list if it matches the
     specified type.`,
    () => {
        let list = parser.parse('(b)');

        verifyList(list, [
            {type: parser.TYPE_GROUP, value: 'b'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        list.trimEnd(parser.TYPE_STRING);

        verifyList(list, [
            {type: parser.TYPE_GROUP, value: 'b'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        list.trimEnd(parser.TYPE_COMMAND_BOUNDARY);

        verifyList(list, [
            {type: parser.TYPE_GROUP, value: 'b'},
        ]);

        list.trimEnd(parser.TYPE_GROUP);

        verifyList(list, []);

        if (!list.isEmpty()) throw 'List is not empty';
    });

    test(
    `Copying an empty list returns an empty list.`,
    () => {
        let result = parser.parse('');
        let copy = result.copy();

        verifyList(result, []);
        verifyList(copy, []);
    });

    test(
    `Copy without arguments copies over the entire list.`,
    () => {
        let result = parser.parse('a(b)"e"');
        let copy = result.copy();

        result.clear();
        verifyList(result, []);

        verifyList(copy, [
            {type: parser.TYPE_TEXT, value: 'a'},
            {type: parser.TYPE_GROUP, value: 'b'},
            {type: parser.TYPE_STRING, value: 'e'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);
    });

    test(
    `Copy without end iterator copies all the way to the end of the list.`,
    () => {
        let result = parser.parse('a(b)"e"');
        let it = result.getIterator();
        it.advance();

        let copy = result.copy(it);

        verifyList(result, [
            {type: parser.TYPE_TEXT, value: 'a'},
            {type: parser.TYPE_GROUP, value: 'b'},
            {type: parser.TYPE_STRING, value: 'e'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        verifyList(copy, [
            {type: parser.TYPE_GROUP, value: 'b'},
            {type: parser.TYPE_STRING, value: 'e'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);
    });

    test(
    `Copy with end iterator copies all the way to the end inclusive.`,
    () => {
        let result = parser.parse('a(b)"e"');

        let itStart = result.getIterator();
        itStart.advance();

        let itEnd = itStart.clone();
        itEnd.advance();

        let copy = result.copy(itStart, itEnd);

        verifyList(result, [
            {type: parser.TYPE_TEXT, value: 'a'},
            {type: parser.TYPE_GROUP, value: 'b'},
            {type: parser.TYPE_STRING, value: 'e'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        verifyList(copy, [
            {type: parser.TYPE_GROUP, value: 'b'},
            {type: parser.TYPE_STRING, value: 'e'},
        ]);
    });

    test(
    `Copy with end iterator at end copies all the way to the end of the list.`,
    () => {
        let result = parser.parse('a(b)"e"');

        let itStart = result.getIterator();
        itStart.advance();

        let itEnd = itStart.clone();
        while (!itEnd.atEnd()) itEnd.advance();

        let copy = result.copy(itStart, itEnd);

        verifyList(result, [
            {type: parser.TYPE_TEXT, value: 'a'},
            {type: parser.TYPE_GROUP, value: 'b'},
            {type: parser.TYPE_STRING, value: 'e'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        verifyList(copy, [
            {type: parser.TYPE_GROUP, value: 'b'},
            {type: parser.TYPE_STRING, value: 'e'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);
    });

    test(
    `Updating the value of a node in a copied list does not effect the original.`,
    () => {
        let result = parser.parse('a(b)"e"');
        let copy = result.copy();

        let it = copy.getIterator();
        it.advance();
        let data = it.getData();
        data.value = 'f';

        verifyList(result, [
            {type: parser.TYPE_TEXT, value: 'a'},
            {type: parser.TYPE_GROUP, value: 'b'},
            {type: parser.TYPE_STRING, value: 'e'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);

        verifyList(copy, [
            {type: parser.TYPE_TEXT, value: 'a'},
            {type: parser.TYPE_GROUP, value: 'f'},
            {type: parser.TYPE_STRING, value: 'e'},
            {type: parser.TYPE_COMMAND_BOUNDARY, value: ''},
        ]);
    });

    logger.log("Completed testing parser.List.Iterator");
    logger.log(`Passes:   ${stats.passes}`);
    logger.log(`Failures: ${stats.failures}`);
}


function runTests()
{
    testParse();
    testParserListIterator();

    let numErrors = logger.numErrors();
    if (numErrors > 0)
    {
        var errorCountElement = document.getElementById('error_count');
        errorCountElement.textContent = `Num Errors: ${numErrors}`;
    }
}


runTests();

