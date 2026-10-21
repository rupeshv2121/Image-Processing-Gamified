function data = codeLabOps(op, p)
%CODELABOPS Run and grade students' MATLAB code (who may run what, and the
%   submissions, are decided by the backend).
%   data = codeLabOps(op, p) - called by ilab_dispatch for:
%   codeTaskList, codeTaskStart, codeTaskSolution, codeWarmup, runCode

switch op
    case 'codeTaskList'
        data = codeTasks('list');

    case 'codeTaskStart'
        data = struct('inputId', ilab_put(codeTasks('input', char(ilab_param(p, 'taskId', ''))), 'taskin'));

    case 'codeTaskSolution'
        data = struct('code', codeTasks('solution', char(ilab_param(p, 'taskId', ''))));

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
taskId = char(ilab_param(p, 'taskId', ''));
code = char(ilab_param(p, 'code', ''));
opts = struct();
if ~isempty(taskId)
    t = codeTasks('get', taskId);
    I = codeTasks('input', taskId);
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
if isempty(taskId), return; end
if ~isempty(r.error)
    data.grade = struct('passed', false, 'match', 0, 'checks', {{}}, 'expectedId', '', 'diffId', '', ...
        'message', 'Your code stopped with an error - fix it (see the Command Window) and run again.');
    return
end
ws = struct();
if r.hasOut, ws.out = r.outValue; end
data.grade = codeTasks('grade', taskId, ws, I);
end
