"use strict";

/**
 * Compiling EDBML source to JavaScript.
 * @extends {Compiler}
 * @TODO precompiler to strip out both JS comments and HTML comments.
 */
class FunctionCompiler extends Compiler {
	
	/**
	 * Construction time again.
	 */
	constructor () {

		/**
		 * Compile sequence.
		 * @type {Array<string>}
		 */
		this._sequence = [ 
			this._uncomment,
			this._validate,
			this._extract,
			this._direct,
			this._define,
			this._compile
		];

		/**
		 * Mapping script tag attributes. 
		 * This may be put to future use.
		 * @type {HashMap<String,String>}
		 */
		this._directives = null;

		/**
		 * Processing intstructions.
		 * @type {Array<Instruction>}
		 */
		this._instructions = null;

		/**
		 * Compiled function arguments list. 
		 * @type {Array<String>}
		 */
		this._params = null;

		/**
		 * Did compilation fail just yet?
		 * @type {boolean}
		 */
		this._failed = false;
	}
		
	/**
	 * Compile source to invocable function.
	 * @param {String} source
	 * @param {Map<String,String} directives
	 * @returns {Result}
	 */
	compile ( source, directives ) {
		this._directives = directives || {};
		this._params = [];
		var head = {
			declarations : {}, // Map<String,boolean>
			functiondefs : [] // Array<String>
		};
		source = this._sequence.reduce (( s, step ) => {
			return step.call ( this, s, head );
		}, source );
		return new Result ( source, this._params, this._instructions );
	}


	// Private ...................................................................

	/**
	 * Strip HTML comments.
	 * @param {string} script
	 * @returns {String}
	 */
	_uncomment(script) {
		script = this._stripout(script,  '<!--', '-->');
		script = this._stripout(script, '/*','*/');
		return script;
	}

	_stripout(script, s1, s2) {
		let a1 = s1.split(''),
			a2 = s2.split(''),
			c1 = a1.shift(),
			c2 = a2.shift();
		s1 = a1.join('');
		s2 = a2.join('');
		let chars = null,
			pass = false,
			next = false,
			fits = (i, l, s) => { return chars.slice(i, l).join('') === s; },
			ahead = (i, s) => { let l = s.length; return fits(i, i + l, s); },
			prevs = (i, s) => { let l = s.length; return fits(i - l, i, s); },
			start = (c, i) => { return c === c1 && ahead(i + 1, s1); },
			stops = (c, i) => { return c === c2 && prevs(i, s2); };
		if (script.contains('<!--')) {
			chars = script.split('');
			return chars.map((chaa, i) => {
				if(pass) {
					if(stops(chaa, i)) {
						next = true;
					}
				} else {
					if(start(chaa, i)) {
						pass = true;
					}
				}
				if(pass || next) {
					chaa = '';
				}
				if(next) {
					pass = false;
					next = false;
				}
				return chaa;
			}).join('');
		}
		return script;
	}

	/**
	 * Confirm no nested EDBML scripts.
	 * @see http://stackoverflow.com/a/6322601
	 * @param {string} script
	 * @returns {String}
	 */
	_validate ( script ) {
		if ( FunctionCompiler._NESTEXP.test ( script )) {
			throw "Nested EDBML dysfunction";
		}
		return script;
	}

	/**
	 * Handle directives. Nothing by default.
	 * @param  {String} script
	 * @returns {String}
	 */
	_direct ( script ) {
		return script;
	}
	
	/**
	 * Extract and evaluate processing instructions.
	 * @param {String} script
	 * @param {What?} head
	 * @returns {String}
	 */
	_extract ( script, head ) {
		Instruction.from ( script ).forEach (( pi ) => {
			this._instructions = this._instructions || [];
			this._instructions.push ( pi );
			this._instruct ( pi );
		});
		return Instruction.clean ( script );
	}

	/**
	 * Evaluate processing instruction.
	 * @param {Instruction} pi
	 */
	_instruct ( pi ) {
		var type = pi.tag;
		var atts = pi.attributes;
		var name = atts.name;
		switch ( type ) {
			case "param" :
				this._params.push ( name );
				break;
		}
	}

	/**
	 * Define stuff in head.
	 * @param {String} script
	 * @param {What?} head
	 * @returns {String}
	 */
	_define ( script, head ) {
		var vars = "", html = "var ";
		each ( head.declarations, ( name ) => {
			vars += ", " + name;
		});

		if ( this._params.indexOf ( "out" ) < 0 ) {
			//html += "out = new edb.Out (), ";
			html += "out = $function.$out, ";
		}

		//if ( this._params.indexOf ( "att" ) < 0 ) {
			html += "att = new edb.Att () ";
		//}
		html += vars + ";\n";
		head.functiondefs.forEach (( def ) => {
			html += def +"\n";
		});
		return html + script;
	}
	
	/**
	 * Compute full script source (including arguments) for debugging stuff.
	 * @returns {String}
	 */
	_source ( source, params ) {
		var lines = source.split ( "\n" ); lines.pop (); // empty line :/
		var args = params.length ? "( " + params.join ( ", " ) + " )" : "()";
		return "function " + args + " {\n" + lines.join ( "\n" ) + "\n}";
	}

}

// Static ..................................................................................

/**
 * RegExp used to validate no nested scripts. Important back when all this was a clientside 
 * framework because the browser can't parse nested scripts, nowadays it might be practical?
 * http://stackoverflow.com/questions/1441463/how-to-get-regex-to-match-multiple-script-tags
 * http://stackoverflow.com/questions/1750567/regex-to-get-attributes-and-body-of-script-tags
 * TODO: stress test for no SRC attribute!
 * @type {RegExp}
 */
FunctionCompiler._NESTEXP = /<script.*type=["']?text\/edbml["']?.*>([\s\S]+?)/g;
