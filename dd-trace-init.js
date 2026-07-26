'use strict';

const enabled = (process.env.DD_TRACE_ENABLED || 'true').toLowerCase() !== 'false';

if (enabled) {
	try {
		const tracer = require('dd-trace').init({
			service: process.env.DD_SERVICE || 'fiapx-api',
			env: process.env.DD_ENV || 'development',
			version: process.env.DD_VERSION || '1.0.0',
			logInjection: (process.env.DD_LOGS_INJECTION || 'true').toLowerCase() === 'true',
		});

		console.log(
			`[Datadog] dd-trace initialized (service=${process.env.DD_SERVICE || 'fiapx-api'}, env=${process.env.DD_ENV || 'development'})`,
		);

		module.exports = tracer;
	} catch (error) {
		const message = error?.message || String(error);
		console.log(`[Datadog] dd-trace initialization failed: ${message}`);
		module.exports = null;
	}
} else {
	console.log('[Datadog] dd-trace disabled by DD_TRACE_ENABLED=false');
	module.exports = null;
}
