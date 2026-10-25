function data = codeLabOps(op, p)
%CODELABOPS Run and grade students' MATLAB code (who may run what, the
%   teacher's task definitions and the submissions are kept by the backend).
%   data = codeLabOps(op, p) - called by ilab_dispatch for:
%   codeTaskTemplates, codeTaskStart, codeTaskCheck, codeWarmup, runCode
%
%   A task arrives as p.task: sample, prep, compare, tol, border,
%   forbidden and solution (the teacher's model solution, MATLAB code that
%   stores the expected result in out).

switch op
    case 'codeTaskTemplates'
        data = codeTasks('templates');

    case 'codeTaskStart'
        data = struct('inputId', ilab_put(codeTasks('input', taskOf(p)), 'taskin'));

    case 'codeTaskCheck'
        data = checkTask(taskOf(p));

    case 'codeWarmup'
        figurePool('warm');                 % the first figure render takes seconds - do it early
        data = struct('warm', true);

    case 'runCode'
        data = runCode(p);

    otherwise
        error('ImageLab:unknownOperation', 'Unknown operation "%s".', op);
end
end

% =========================================================================
function data = runCode(p)
% Run the code on the task's input (graded) or on the current / sample image
t = [];
if isfield(p, 'task') && isstruct(p.task), t = taskOf(p); end
code = char(ilab_param(p, 'code', ''));
opts = struct();
if ~isempty(t)
    I = codeTasks('input', t);
    opts.forbidden = t.forbidden;
elseif ~isempty(ilab_param(p, 'id', ''))
    I = ilab_img(p);
else
    generateSampleImages(false);
    I = ilab_limitSize(toDouble(imread(sampleImages('path', 'peppers.png'))));
end
r = runStudentCode(code, I, opts);
data = rmfield(r, {'outValue', 'hasOut'});
data.grade = [];
data.newBadges = {};
if isempty(t), return; end
if ~isempty(r.error)
    data.grade = struct('passed', false, 'match', 0, 'checks', {{}}, 'expectedId', '', 'diffId', '', ...
        'message', 'Your code stopped with an error - fix it (see the Command Window) and run again.');
    return
end
ws = struct();
if r.hasOut, ws.out = r.outValue; end
data.grade = codeTasks('grade', t, ws, expectedOf(t, I));
end

% =========================================================================
function data = checkTask(t)
% Teacher: run the model solution on the task's input and show its result
I = codeTasks('input', t);
r = runStudentCode(t.solution, I, struct('maxImages', 0, 'figures', false));
data = struct('inputId', ilab_put(I, 'taskin'), 'expectedId', '', 'output', r.output, ...
    'error', r.error, 'size', '', 'class', '', 'ok', false, 'message', '');
if ~isempty(r.error)
    data.message = sprintf('The model solution stopped with an error: %s', r.error.message);
    return
end
if ~r.hasOut
    data.message = 'The model solution must store the expected result in a variable called out.';
    return
end
E = r.outValue;
data.size = strjoin(arrayfun(@num2str, size(E), 'UniformOutput', false), char(215));
data.class = class(E);
if ~(isnumeric(E) || islogical(E)) || ~isreal(E) || isempty(E)
    data.message = 'out must be a non-empty numeric or logical array.';
    return
end
if strcmp(t.compare, 'vector')
    data.ok = true;
    data.message = sprintf('OK: out is a vector with %d values.', numel(E));
    return
end
if size(E, 1) ~= size(I, 1) || size(E, 2) ~= size(I, 2)
    data.message = sprintf('out is %s, but an image result must have the size of img (%d%s%d).', ...
        data.size, size(I, 1), char(215), size(I, 2));
    return
end
shown = double(E);
if isinteger(E), shown = shown / double(intmax(class(E))); end
if strcmp(t.compare, 'normalized'), shown = abs(shown) / max(max(abs(shown(:))), eps); end
data.expectedId = ilab_store('save', min(max(shown, 0), 1), 'expected');
data.ok = true;
data.message = 'OK: the model solution runs and produces the expected result shown here.';
end

% =========================================================================
function E = expectedOf(t, I)
% The model solution's out on this input, remembered per task definition
% (every student run of the same task reuses it)
persistent cache order
if isempty(cache), cache = containers.Map(); order = {}; end
key = [char(t.solution) '|' char(t.sample) '|' char(t.prep)];
if isKey(cache, key)
    E = cache(key);
    return
end
r = runStudentCode(t.solution, I, struct('maxImages', 0, 'figures', false));
if ~isempty(r.error) || ~r.hasOut
    error('ImageLab:taskBroken', ['The model solution of this task does not work, so your code cannot ' ...
        'be checked. Please tell your teacher.']);
end
E = r.outValue;
cache(key) = E;
order{end+1} = key;
if numel(order) > 30
    remove(cache, order{1});
    order(1) = [];
end
end

function t = taskOf(p)
% The task definition sent by the backend, with list fields as cell arrays
t = ilab_param(p, 'task', struct());
if ~isstruct(t)
    error('ImageLab:invalidParameter', 'Missing Code Lab task.');
end
t.sample = char(field(t, 'sample', 'peppers.png'));
t.prep = char(field(t, 'prep', 'gray'));
t.compare = char(field(t, 'compare', 'image'));
t.tol = double(field(t, 'tol', 1e-3));
t.border = double(field(t, 'border', 0));
t.solution = char(field(t, 'solution', ''));
f = field(t, 'forbidden', {});
if ischar(f) || isstring(f), f = cellstr(f); end
if ~iscell(f), f = {}; end
t.forbidden = f;
end

function v = field(s, name, default)
if isfield(s, name) && ~isempty(s.(name)), v = s.(name); else, v = default; end
end
