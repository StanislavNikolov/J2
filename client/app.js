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
};

sbmBtnEl.onclick = () => {
	if(selectedProbEl == null) {
		// TODO user feedback
		return;
	}
	const placeholderHTML = `<tr class='ui placeholder'><td colspan=4>Submitting...</td></tr>`;
	const placeholderEl = document.createElement('template');
	placeholderEl.innerHTML = placeholderHTML;
	sbmTableEl.prepend(placeholderEl.content.firstChild);

	fetch('/submit', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({code: codeinputEl.value, problem: selectedProbEl.id})
	})
	.then();
};

const renderProblemList = () => {
	for(const prob of problems) {
		console.log(prob);
		const el = document.createElement('div')
		problemListEl.appendChild(el);

		el.classList.add('problem');
		el.id = 'p$' + prob.id;
		el.innerText = prob.name;
		el.onclick = () => markSelected(el);
	}
};

const renderSubmissionsTable = () => {
	for(const el of submissionsList.getElementsByClassName('placeholder')) {
		el.style.display = 'none';
	}
	for(const sbm of submissions) {
		const el = document.createElement('tr')
		sbmTableEl.appendChild(el);

		el.classList.add('submission');
		el.id = 's$' + sbm.sid;
		const dlBtnHTML = `<button class="ui mini compact icon button"><i class="download icon"></i></button>`;
		el.innerHTML = `<td>asd</td><td>12</td><td> compile error </td><td>${dlBtnHTML}`;
	}
};

window.onload = () => {
	fetch('/problems')
	.then(resp => resp.json())
	.then(json => {
		problems = json;
		renderProblemList();
	});

	fetch('/submissions')
	.then(resp => resp.json())
	.then(json => {
		submissions = json;
		renderSubmissionsTable();
	});
}
