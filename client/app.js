const problemListEl = document.getElementById('problist');
const sbmTableEl  = document.getElementById('submissionsList').getElementsByTagName('tbody')[0];
const sbmBtnEl    = document.getElementById('submit');
const codeinputEl = document.getElementById('codeinput');

let problems = [];
let submissions = [];

let selectedProbEl = null;

const markSelected = (el) => {
	// unselect all problems
	for(const probEl of problemListEl.getElementsByClassName('problem')) {
		probEl.classList.remove('selected');
	}

	selectedProbEl = el;
	el.classList.add('selected');

	renderSubmissionsTable();
	showCorrectStatement();
};

const showCorrectStatement = () => {
	const probId = Number(selectedProbEl.id.substring(2));
	const prob = problems.find(x => x.id === probId);

	const wrapper = document.getElementById('statementWrapper');
	if(prob.statement_type == null) {
		wrapper.innerHTML = '';
	} else if(prob.statement_type === 'PDF') {
		wrapper.innerHTML = `
		<object id='statement' type="application/pdf" data="/statement/${prob.id}.pdf" width=100% height=100%>
			<p>Statement cannot be displayed :(</p>
		</object>
		`;
		console.log('asd');
	} else if(prob.statement_type === 'plaintext') {
		fetch(`/statement/${prob.id}`)
		.then(resp => resp.text())
		.then(statement => {
			wrapper.innerHTML = `<div class='pre'>${statement}</div>`;
		});
	} else {
		// TODO
		console.error('Unsupported statement type', prob.statement_type);
	}
};

const watchSubmissionForUpdates = (subId, el) => {
	const poll = () => {
		fetch(`/submissions/${subId}`)
		.then(resp => resp.json())
		.then(data => {
			const newEl = renderSubmission(data.submissions[0], data.executions);
			el.parentNode.replaceChild(newEl, el);
			el = newEl;
			if(data.submissions[0].judged !== 0) {
				submissions.push(data.submissions[0]);
				executions = executions.concat(data.executions);
				return;
			}
			setTimeout(poll, 100);
		});
	};
	poll();
};

sbmBtnEl.onclick = () => {
	if(selectedProbEl == null) {
		// TODO user feedback
		return;
	}

	const placeholderHTML = `<tr class='ui placeholder'><td colspan=4>Submitting...</td></tr>`;
	const template = document.createElement('template');
	template.innerHTML = placeholderHTML;
	const placeholderEl = template.content.firstChild;

	sbmTableEl.prepend(placeholderEl);

	const probId = selectedProbEl.id.substring(2);
	fetch(`/submit/${probId}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({code: codeinputEl.value})
	})
	.then(resp => resp.json())
	.then(data => {
		console.log(data.id);
		watchSubmissionForUpdates(data.id, placeholderEl);
	});
};

const renderProblemList = () => {
	let first = true;
	for(const prob of problems) {
		const el = document.createElement('span')
		//el.setAttribute('d
		problemListEl.appendChild(el);

		el.classList.add('problem', 'ui', 'button');
		el.id = 'p$' + prob.id;
		el.innerText = prob.name;
		el.onclick = () => markSelected(el);

		if(first) {
			markSelected(el);
			first = false;
		}
	}
};

const renderExecution = (exec) => {
	const el = document.createElement('span');
	if(exec.verdict === 'CS') return el;

	el.classList.add('execution');
	if(exec.verdict === 'OK') el.classList.add('good');
	else                      el.classList.add('bad');

	el.innerHTML = `${exec.verdict}`;
	return el;
};

const renderSubmission = (sbm, executions) => {
	const el = document.createElement('tr')

	el.classList.add('submission');
	el.id = 's$' + sbm.id;

	// show animation if more executions are expected to come
	if(sbm.judged === 0) el.classList.add('judging');

	// get all executions for this submission
	let execs = executions.filter(x => x.sid === sbm.id);

	// sort by id
	execs.sort((a, b) => a.id - b.id);

	// render to 'details' element
	const details = document.createElement('div');
	execs.map(x => details.appendChild(renderExecution(x)));

	const date = (new Date(sbm.date)).toISOString().substring(0, 16).replace('T', ' ');
	const score = (sbm.score == null ? 0 : sbm.score.toFixed());

	const dlBtnHTML = `<button class="ui mini compact icon button"><i class="download icon"></i></button>`;
	el.innerHTML = `<td>${date}</td><td>${score}</td><td>${details.innerHTML}</td><td>${dlBtnHTML}`;

	return el;
};

const renderSubmissionsTable = () => {
	// get id of currently selected problem
	const probId = Number(selectedProbEl.id.substring(2));

	// get all submissions for this problem
	let sbms = submissions.filter(x => x.problem_id === probId);

	// sort by date
	sbms.sort((a, b) => b.date - a.date);

	// clear table
	sbmTableEl.innerHTML = '';

	// fill table
	sbms.map(x => sbmTableEl.appendChild(renderSubmission(x, executions)));
};

window.onload = () => {
	let submissionReady = false;
	let problemsReady = false;
	const ready = (what) => {
		if(what === 'submissions') {
			submissionReady = true;
			if(problemsReady) renderSubmissionsTable();
		} else if(what === 'problems') {
			problemsReady = true;
			renderProblemList();
			if(submissionReady) renderSubmissionsTable();
		}
	};

	fetch('/problems')
	.then(resp => resp.json())
	.then(json => {
		problems = json;
		ready('problems');
	});

	fetch('/submissions/all')
	.then(resp => resp.json())
	.then(json => {
		submissions = json.submissions;
		executions = json.executions;
		ready('submissions');
	});
}
