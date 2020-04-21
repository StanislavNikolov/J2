let problems = [];

const toggle = (prob) => {
	if(prob.user_visible === 1) prob.user_visible = 0;
	else                        prob.user_visible = 1;

	fetch(`/admin/set_state/${prob.id}/${prob.user_visible}`, {method: 'POST'});
	const currEl = document.getElementById('p$' + prob.id);
	currEl.parentNode.replaceChild(renderProblem(prob), currEl);
};

const renderProblem = (prob) => {
	const el = document.createElement('span')

	el.classList.add('problem', 'ui', 'button');
	if(prob.user_visible !== 1) el.classList.add('hidden');
	el.id = 'p$' + prob.id;
	el.innerText = prob.name;
	el.onclick = () => toggle(prob);

	return el;
};

const render = () => {
	problems.map(p => document.getElementById('problems').appendChild(renderProblem(p)));
};

fetch('/admin/problems')
.then(resp => resp.json())
.then(data => {
	problems = data;
	render();
});
