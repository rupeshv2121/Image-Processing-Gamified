function data = runStudentCode(code, img, opts)
%RUNSTUDENTCODE Run a student's MATLAB code for the Code Lab page.
%   data = runStudentCode(code, img, opts)
%
%   The code runs as a script in its own, empty workspace that contains
%       img  - the input image, double in [0,1]   (also available as I)
%   It may print to the Command Window, draw figures (imshow, plot, bar...)
%   and should leave its result image in the variable  out.
%
%   opts (optional struct):
%       forbidden - cell array of function names the code must not call,
%                   e.g. {'imfilter','conv2'} for "write the loop yourself"
%       maxImages - workspace image variables to return (default 6)
%       figures   - false: do not export the figures the code draws
%                   (default true)
%
%   data fields:
%       output     Command Window text (like MATLAB's command window)
%       error      [] or struct(message, line)
%       figures    image-store ids of every figure the code created
%       variables  workspace summary (name, size, class, preview, imageId)
%       outValue   the variable "out" (empty if the code did not set it)
%       timeMs     execution time
%
%   Guard rails: calls that touch files, the operating system, the network
%   or the MATLAB session itself (system, delete, cd, save, clear all,
%   input, ...) are rejected before the code runs. This keeps a classroom
%   safe from accidents; it is not a security sandbox - the ImageLab server
%   only listens on this computer (127.0.0.1).

if nargin < 3 || isempty(opts), opts = struct(); end
code = char(code);
if isempty(strtrim(code))
    error('ImageLab:invalidParameter', 'Write some MATLAB code first.');
end
if numel(code) > 50000
    error('ImageLab:invalidParameter', 'The code is too long (max 50 000 characters).');
end
checkCode(code, field(opts, 'forbidden', {}));

% Toolbox stand-ins (imfilter, fspecial, medfilt2, ...) are only on the path
% while student code runs, and only when the real toolbox is missing.
% "figure" itself is replaced by a pool of reusable hidden figures.
hasIPT();                                    % cache the answer before shimming
here = fileparts(mfilename('fullpath'));
root = fileparts(here);
shimDirs = {fullfile(here, 'pool')};
if ~hasIPT(), shimDirs{end+1} = fullfile(here, 'shims'); end
warnState = warning('off', 'MATLAB:dispatcher:nameConflict');   % figure.m shadows the built-in on purpose
addpath(shimDirs{:});
warning(warnState);
restorePath = onCleanup(@() rmpath(shimDirs{:}));

% Figures stay invisible; the ones the code draws are exported as PNG
oldVisible = get(groot, 'DefaultFigureVisible');
set(groot, 'DefaultFigureVisible', 'off');
restoreFig = onCleanup(@() set(groot, 'DefaultFigureVisible', oldVisible));
figsBefore = findall(groot, 'Type', 'figure');
figurePool('begin');

% The code is saved as a uniquely named script so that error messages carry
% the right line numbers and local functions at the end of the code work.
codeDir = fullfile(root, 'runtime', 'code');
if ~isfolder(codeDir), mkdir(codeDir); end
[~, u] = fileparts(tempname);
name = ['ilab_code_' regexprep(u(end-11:end), '[^A-Za-z0-9]', '')];
file = fullfile(codeDir, [name '.m']);
fid = fopen(file, 'w', 'n', 'UTF-8');
fwrite(fid, code, 'char');
fclose(fid);
removeFile = onCleanup(@() cleanupScript(file, name));

t0 = tic;
[output, err, ws] = sandbox(file, img);
timeMs = 1000 * toc(t0);

data = struct('output', clip(output, 20000), 'error', [], 'figures', {{}}, ...
    'variables', {{}}, 'outValue', [], 'hasOut', false, 'timeMs', timeMs);
if ~isempty(err)
    data.error = describeError(err, file, name);
end

% Figures drawn by the code: pool figures in order of use, then any others
[drawn, pool] = figurePool('end');
others = setdiff(findall(groot, 'Type', 'figure'), [figsBefore; pool(:); drawn(:)]);
figs = [drawn(:); others(:)];
for k = 1:numel(figs)
    try
        if field(opts, 'figures', true) && numel(data.figures) < 6 && ~isempty(figs(k).Children)
            data.figures{end+1} = saveFigure(figs(k));
        end
    catch
        % an unexportable figure must not hide the rest of the results
    end
    if ismember(figs(k), pool), clf(figs(k)); else, delete(figs(k)); end
end

% Workspace summary (like MATLAB's Workspace browser)
names = fieldnames(ws);
if isfield(ws, 'out')
    names = [{'out'}; names(~strcmp(names, 'out'))];
    data.outValue = ws.out;
    data.hasOut = true;
end
nImages = 0;
maxImages = field(opts, 'maxImages', 6);
for k = 1:min(numel(names), 40)
    v = ws.(names{k});
    entry = struct('name', names{k}, 'size', sizeText(v), 'class', class(v), ...
        'preview', preview(v), 'imageId', '', 'clipped', false);
    if nImages < maxImages && isImageLike(v)
        [shown, entry.clipped] = displayable(v);
        entry.imageId = ilab_store('save', shown, 'var');
        nImages = nImages + 1;
    end
    data.variables{end+1} = entry;
end
end

% =========================================================================
function [ilabOutput__, ilabError__, ilabWs__] = sandbox(ilabFile__, img) %#ok<INUSD>
% Runs the script in THIS function's workspace, so the student's variables
% never mix with ImageLab's. Only img / I exist at the start.
I = img; %#ok<NASGU>
ilabError__ = [];
ilabOutput__ = evalc('try, run(ilabFile__); catch ilabCaught__, ilabError__ = ilabCaught__; end');
if ~exist('ilabError__', 'var'), ilabError__ = []; end   % code ran "clear"
if exist('ilabCaught__', 'var') && isempty(ilabError__), ilabError__ = ilabCaught__; end
ilabWs__ = struct();
ilabNames__ = who;
for ilabK__ = 1:numel(ilabNames__)
    if isempty(regexp(ilabNames__{ilabK__}, '__$', 'once'))
        ilabWs__.(ilabNames__{ilabK__}) = eval(ilabNames__{ilabK__});
    end
end
end

function checkCode(code, forbidden)
% Reject calls that could damage files or the shared MATLAB session
src = stripCommentsAndStrings(code);
if ~isempty(regexp(src, '(^|\n)\s*!', 'once'))
    error('ImageLab:codeBlocked', 'Shell commands (!) are not allowed in the Code Lab.');
end
blocked = {'system', 'dos', 'unix', 'perl', 'winopen', 'delete', 'rmdir', 'movefile', ...
    'copyfile', 'mkdir', 'cd', 'addpath', 'rmpath', 'path', 'savepath', 'userpath', ...
    'restoredefaultpath', 'eval', 'evalc', 'evalin', 'assignin', 'feval', 'builtin', ...
    'str2func', 'run', 'exit', 'quit', 'fopen', 'fwrite', 'save', 'diary', 'setenv', ...
    'websave', 'webwrite', 'webread', 'urlread', 'urlwrite', 'ftp', 'sendmail', 'tcpclient', ...
    'java', 'javaObject', 'javaMethod', 'javaaddpath', 'py', 'pyrun', 'pyrunfile', 'NET', ...
    'actxserver', 'input', 'keyboard', 'ginput', 'waitforbuttonpress', 'uiwait', 'waitfor', ...
    'inputdlg', 'questdlg', 'dbstop', 'imwrite', 'exportgraphics', 'print', 'saveas', ...
    'mex', 'loadlibrary', 'parpool', 'batch', 'timer', 'munlock', 'mlock'};
used = unique(regexp(src, '(?<![\w.])[A-Za-z]\w*', 'match'));
% a name the code assigns (input = img; path = ...) is a variable, not a call
assigned = regexp(src, '(?<![\w.=~<>])([A-Za-z]\w*)\s*(\([^()=]*\))?\s*=(?!=)', 'tokens');
assigned = cellfun(@(t) t{1}, assigned, 'UniformOutput', false);
multi = regexp(src, '\[([^\]=]*)\]\s*=(?!=)', 'tokens');
for k = 1:numel(multi)
    assigned = [assigned, regexp(multi{k}{1}, '[A-Za-z]\w*', 'match')]; %#ok<AGROW>
end
used = setdiff(used, assigned);
bad = intersect(used, blocked);
if ~isempty(bad)
    error('ImageLab:codeBlocked', ['"%s" is not allowed in the Code Lab: it could change files ' ...
        'or the shared MATLAB session. Remove it and run again.'], bad{1});
end
if ~isempty(regexp(src, '(?<![\w.])clear\s*(\(\s*)?[''"]?\s*-?(all|functions|classes|global|mex|import|java|variables\s+-?global)\>', 'once')) ...
        || ~isempty(regexp(src, '(?<![\w.])clear\s+-', 'once'))
    error('ImageLab:codeBlocked', ['"clear all" / "clear functions" would reset the shared MATLAB ' ...
        'session. Use "clear" or "clearvars" to empty your workspace.']);
end
forbidden = cellstr(forbidden);
bad = intersect(used, forbidden);
if ~isempty(bad)
    error('ImageLab:codeForbidden', ['This task asks you to write the algorithm yourself, ' ...
        'so %s is not allowed here. Not allowed: %s.'], bad{1}, strjoin(forbidden, ', '));
end
end

function s = stripCommentsAndStrings(code)
% Blank out comments and string literals before scanning for names.
% A ' starts a char literal unless it follows a name, a number, a closing
% bracket, a dot or another quote - then it is the transpose operator.
code = regexprep(code, '(?m)^\s*%\{.*?^\s*%\}', '');
s = code;
n = numel(code);
k = 1;
prev = ' ';                                 % last significant character
while k <= n
    ch = code(k);
    if ch == '%' || (ch == '.' && k + 2 <= n && strcmp(code(k:k+2), '...'))
        e = find(code(k:end) == newline, 1);
        if isempty(e), e = n - k + 2; end
        s(k:k+e-2) = ' ';
        k = k + e - 1;
        prev = ' ';
    elseif ch == '"' || (ch == '''' && isempty(regexp(prev, '[\w)\]}.''"]', 'once')))
        e = k + 1;
        while e <= n && code(e) ~= newline
            if code(e) == ch
                if e < n && code(e + 1) == ch, e = e + 2; continue; end   % '' inside
                break
            end
            e = e + 1;
        end
        s(k:min(e, n)) = ' ';
        k = e + 1;
        prev = 'x';                         % a literal ends like a value
    else
        if ~isspace(ch), prev = ch; end
        k = k + 1;
    end
end
end

function e = describeError(err, file, name)
msg = err.message;
line = [];
if ~isempty(err.stack)
    idx = find(strcmp({err.stack.file}, file) | strcmp({err.stack.name}, name), 1);
    if ~isempty(idx), line = err.stack(idx).line; end
end
tok = regexp(msg, 'Line:\s*(\d+)', 'tokens', 'once');      % syntax errors
if isempty(line) && ~isempty(tok), line = str2double(tok{1}); end
msg = regexprep(msg, '<a [^>]*>|</a>', '');
msg = regexprep(msg, '(Error:\s*)?File:.*?\s+Line:\s*\d+\s+Column:\s*\d+\s*', '');   % shown as "line N"
msg = strrep(msg, file, 'your code');
msg = strrep(msg, name, 'your code');
if strcmp(err.identifier, 'MATLAB:UndefinedFunction') && contains(msg, '''out''')
    msg = [msg ' (set the variable out to your result image)'];
end
e = struct('message', strtrim(msg), 'line', line, 'identifier', err.identifier);
end

function id = saveFigure(f)
% print is several times faster than exportgraphics on a reused figure
[~, u] = fileparts(tempname);
id = ['fig_' u(end-11:end)];
f.Color = 'w';
print(f, fullfile(ilab_store('dir'), [id '.png']), '-dpng', '-r96');
end

function cleanupScript(file, name)
clear(name);
if isfile(file), delete(file); end
end

function tf = isImageLike(v)
tf = (isnumeric(v) || islogical(v)) && isreal(v) && ~isempty(v) && ...
    (ismatrix(v) || (ndims(v) == 3 && size(v, 3) == 3)) && min(size(v, 1), size(v, 2)) >= 8;
end

function [J, clipped] = displayable(v)
% Show the variable the way imshow would (doubles are clipped to [0,1])
if islogical(v)
    J = v; clipped = false;
elseif isinteger(v)
    J = double(v) / double(intmax(class(v))); clipped = false;
else
    v = double(v);
    v(~isfinite(v)) = 0;
    clipped = any(v(:) < 0 | v(:) > 1);
    J = min(max(v, 0), 1);
end
end

function s = sizeText(v)
s = strjoin(arrayfun(@num2str, size(v), 'UniformOutput', false), char(215));
end

function p = preview(v)
p = '';
try
    if ischar(v) || isstring(v)
        p = ['"' clip(char(join(string(v), ' ')), 60) '"'];
    elseif (isnumeric(v) || islogical(v)) && numel(v) <= 36 && ismatrix(v)
        p = clip(mat2str(v, 4), 120);
    elseif isnumeric(v) && ~isempty(v)
        d = double(v(:));
        p = sprintf('min %.4g · max %.4g', min(d), max(d));
    elseif isstruct(v)
        p = clip(['fields: ' strjoin(fieldnames(v)', ', ')], 80);
    elseif iscell(v)
        p = sprintf('cell (%d items)', numel(v));
    end
catch
end
end

function s = clip(s, n)
if numel(s) > n, s = [s(1:n) '…']; end
end

function v = field(s, name, default)
if isstruct(s) && isfield(s, name) && ~isempty(s.(name)), v = s.(name); else, v = default; end
end
