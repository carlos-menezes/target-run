#!/usr/bin/env node

import { dispatch } from '../dist/dispatch.js';

const options = {
	verbose: process.env['RSOA_DEBUG'] === '1',
	dryRun: process.env['RSOA_DRY_RUN'] === '1',
};

// Parse command-line flags
for (let i = 2; i < process.argv.length; i++) {
	switch (process.argv[i]) {
		case '--verbose':
			options.verbose = true;
			break;
		case '--dry-run':
			options.dryRun = true;
			break;
		case '--optional':
			options.optional = true;
			break;
		case '--required':
			options.required = true;
			break;
		case '--cwd':
			const cwdValue = process.argv[++i];
			if (cwdValue) options.cwd = cwdValue;
			break;
	}
}

dispatch(options);
