function init() {}
function print(a) { console.log(a); }
function print_all(a) { for (var i in a) { print(a[i]); } }


function stream(str) {
    var i = 0;
    var l = str.length;
    return {
        read: function() { return (i < l) ? str[i++] : null; },
        eof:  function() { return i == l; }
    };
}


function Forth(prgrm) {
    var s = [];
    var r = [];
    var w = {};
    var input = null;
    //var i = null; //stream(prgrm);

    this.stack        = s;
    this.return_stack = r;
    this.words        = w;

    var current_word = null;
    var compiling    = false;
    var stack_depth;

    var to_word = function(c, f, imm) {
        var word = function() {
            var len  = s.length;
            var args = s.splice(len - c, len);
            var res  = f.apply(this, args);
            for (var i = 0; i < res.length; i++) s.push(res[i]);
        };
        word.immediate = imm;
        return word;
    };
    this.to_word = to_word;

    var constant_word = function(c) {
        return to_word(0, function() { return [c]; }, false); };

    w['bl'] = constant_word(' ');
    w['word'] = to_word(1,
                        function(a) {
                            var w  = ''; // word
                            var ws = true; // was separator?
                            while (true) {
                                var c = input.read();
                                // is separator?
                                var is = c == a || a == ' ' && (c == "\n" ||
                                                                c == "\t");

                                if (c == null) break; // eof

                                if ( ws && is) continue;
                                if (!ws && is) break;

                                w += c;

                                ws = is;
                            }
                            return [w];
                        });

    w['find']    = to_word(1, function(a) {
                           var fw = w[a];
                           return (fw == undefined)
                                ? [a, 0]
                                : [fw, (fw.immediate == true) ? 1 : -1];
                           });
    w['execute'] = to_word(1, function(a) { a(); return []; });

    w['is_number'] = to_word(1, function(a) {
                           return [a, a.match(/[0-9]+/) != null]; });

    w['interpret'] = to_word(0,
                             function () {
                                while (true) {
                                    w.bl(); w.word();
                                    w.dup();
                                    var word = s.pop();
                                    if (word == '') break; // no more words
                                    w.is_number();
                                    if (s.pop() == false) {
                                        w.find();
                                        var im = s.pop();
                                        if (im == 0) // not found
                                            throw "Neradau as to zdz '" + word + "'";
                                        else if (im == 1) // immediate
                                            w.execute();
                                        else if (im == -1) // normal
                                            w.execute();
                                    } else {
                                        s.push(s.pop()*1); // paverst i skaiciu
                                    }
                                }
                                return [];
                             });

    w['create'] = to_word(0,
                          function() {
                            w.bl();
                            w.word();
                            var word = s.pop();
                            w[word] = [];
                            return [];
                          });

    //var pc = 0; // program counter
    w[':'] = to_word(0, function() {
                            w.depth(); stack_depth = s.pop();
                            w.bl();
                            w.word();
                            var word = s.pop();
                            var f = function() {
                                //pc = -1;
                                f.pc = -1;
                                var l = f.code.length - 1;
                                var max_iterations = 20;
                                var iteration = 0;
                                while (f.pc < l) {
                                    iteration++;
                                    if (iteration >= max_iterations) {
                                        print("Reached max iterations");
                                        break;
                                    }
                                    f.pc++;
                                    //print("pc: " + f.pc + ", word: "
                                          //+ find_word_by_addr(f.code[f.pc])
                                          //+ ", cnst: " + f.code[f.pc].constant);
                                    f.code[f.pc]();
                                }
                            };
                            w[word] = f;
                            current_word = w[word];
                            current_word.code = [];
                            w[']']();
                            return [];
                        });

    w['immediate'] = to_word(0, function() {
                                    current_word.immediate = true;
                                    return [];
                                });

    w[']'] = to_word(0, function() { // the compiler
                            compiling = true;
                            while (true) {
                                if (compiling == false) break;
                                w.bl(); w.word();
                                w.dup();
                                var word = s.pop();
                                if (word == '') break;
                                w.is_number();
                                if (s.pop() == false) {
                                    w.find();
                                    var im = s.pop();
                                    if (im == 0) // not found
                                        throw "Neradau zdz kompiliuodamas '" + word + "'";
                                    else if (im == 1) // immediate
                                        w.execute();
                                    else if (im == -1) // normal
                                        current_word.code.push(s.pop()); // add to code
                                } else {
                                    var f = function(n) {
                                        var cnst = function() {
                                            s.push(n);
                                        };
                                        cnst.constant = n;
                                        return cnst;
                                    };
                                    //var f = function(n)
                                        //{ return function() { s.push(n); }; };
                                    s.push(f(s.pop() * 1));
                                    push_word();
                                }
                            }
                            return [];
                        });
    w['['] = to_word(0, function() {
                            compiling = false;
                            return [];
                        }, true);

    w['literal'] = to_word(1, function(a) {
                                current_word.code.push(function(){s.push(a);});
                                return [];
                              }, true);

    
    w['see'] = to_word(0, function() {
                            w["'"]();
                            var word = s.pop();
                            var dis = "";
                            for (i in word.code) {
                                var el = word.code[i];
                                var a = find_word_by_addr(word.code[i]);
                                if (a)
                                    dis += a + " ";
                                else if (typeof el == "object")
                                    dis += "[" + el[0] + "] ";
                                else
                                    dis += "const ";
                            }
                            print(dis);
                            return [];
                          });

    var find_word_by_addr = function(a) {
        for (var i in w)
            if (w[i] == a) return i;
        return null;
    };
    w[';'] = to_word(0, function()  {
                            w.depth();
                            if (s.pop() != stack_depth)
                                throw "Stack depth chanded during : and ; while compiling " + find_word_by_addr(current_word);
                            w['['](); return [];
                        }, true);

    w['>r'] = to_word(1, function(a) { r.push(a); return []; });
    w['r>'] = to_word(0, function()  { return [r.pop()]; });
    w['r@'] = to_word(0, function()  { return [r[r.length - 1]]; });

    w["'"] = to_word(0, function() { // xxx: is very similar to find
                            w.bl(); w.word(); var word = s.pop();
                            return [w[word]];
                        });

    //w['here'] = to_word(0, function() { return []; });
    //w[','] = to_word(1, function(a) { return []; });

    var push_word = to_word(1, function(a) { 
                                current_word.code.push(a); return []; });

    w['compile'] = to_word(0, function() {
                                if (!compiling)
                                    throw "'compile' used outside of : ;";
                                w["'"]();
                                var word = s.pop();
                                current_word.code.
                                    push(
                                         (word.immediate)
                                         ? word
                                         : function() {
                                            current_word.code.push(word); }
                                        );
                                return [];
                            }, true);

    w['true'] = constant_word(true);
    w['false'] = constant_word(false);
    w['not'] = to_word(1, function(a) { return [!a]; });
    

    var as = []; // address stack
    w['>mark'] = to_word(0, function() {
                                var mark = [-1];
                                current_word.code.push(mark);
                                as.push(mark);
                                return [];
                            }, false);
    w['>resolve'] = to_word(0, function() {
                                    var a = as.pop();
                                    a[0] = current_word.code.length;
                                    return [];
                               }, false);
    w['<mark'] = to_word(0, function() {return [];});
    w['<resolve'] = to_word(0, function() {return [];});
    w['branch'] = to_word(0, function() {
                                var pc = current_word.pc;
                                var addr = current_word.code[pc + 1][0];
                                current_word.pc = addr - 1;
                                return [];
                             }, false);
    w['?branch'] = to_word(1, function(f) {
                                if (!f) w.branch();
                                // skip the marked address
                                else current_word.pc++;
                                return [];
                              }, false);


    w['dup'  ] = to_word(1, function(a) { return [a, a]; });
    w['drop' ] = to_word(1, function(a) { return []; });
    w['depth'] = to_word(0, function()  { return [s.length]; });

    w['swap' ] = to_word(2, function(a,b) { return [b, a]; });

    w['+'    ] = to_word(2, function(a,b) { return [a + b]; });
    w['-'    ] = to_word(2, function(a,b) { return [a - b]; });
    w['*'    ] = to_word(2, function(a,b) { return [a * b]; });
    w['/'    ] = to_word(2, function(a,b) { return [a / b]; });

    w['.'    ] = to_word(1, function(a) { print(a); return []; });
    w['.s'   ] = to_word(0, function()  { print(s); return []; });
    w['ss'   ] = w['.s'];

    w['('    ] = to_word(0, function() { s.push(')'); w.word(); s.pop();
                                         return []; });
    w['char' ] = to_word(0, function() { w.bl(); w.word();
                                         return []; });
    w['."'   ] = to_word(0, function() { s.push('"'); w.word();
                                         return []; });


    w['show'] = to_word(0, function() { w.bl(); w.word();
                                        print_all(w[s.pop()].code);
                                        return []; });
    // conditional stack
    var cs = [];
    w['>cs'] = to_word(1, function(a) { return cs.push(a); []; });
    w['cs>'] = to_word(0, function(a) { return [cs.pop()]; });


    var bootstrap = <forth>

        : if compile dup compile >cs compile ?branch >mark ; immediate
        : else >resolve
               compile cs> compile not compile ?branch >mark ; immediate
        : then >resolve ; immediate

        </forth>;


    this.run = w.interpret;

    input = stream(bootstrap + ''); this.run();
    s = [];
    input = stream(prgrm);
}

function forth(p) { return new Forth(p); }


var forth_program = <forth>
: mamamija 9 2 3 ;
: hello true if 4 mamamija else 2 then 1 ;
hello .s
: profiliavimui false if 1 else 2 then drop ;
</forth>;


function prof(name, f, times, tries) {
    var accum_time = 0;
    for (var i = 0; i < tries; i++) {
        var t1 = new Date().getTime();
        for (var j = 0; j < times; j++) f();
        var t2 = new Date().getTime();
        accum_time += t2 - t1;
    }
    console.log(name + ": " + (accum_time / tries));
}

var f = forth(forth_program + '');
var s = f.stack;
var w = f.words;
f.run();


prof("forth", w.profiliavimui, 1000, 3);
function profiliavimui() { if (false) { return 1; } else {return 2;};}
prof("js", profiliavimui , 1000, 3);

