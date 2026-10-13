function file = generateReportPdf(R, file)
%GENERATEREPORTPDF Write an experiment report as a multi-page A4 PDF.
%   file = generateReportPdf(R, file) uses only base MATLAB: every page is
%   laid out in an invisible figure (text, tables, kernel and the result
%   images) and appended to the PDF with exportgraphics.
%   R has the same fields as for generateReport.

pageW = 21; pageH = 29.7;                 % A4 in centimetres
margin = 1.8;
textW = pageW - 2 * margin;
navy = [0.07 0.19 0.35];
grey = [0.35 0.4 0.48];
ink = [0.09 0.13 0.23];

fig = figure('Visible', 'off', 'Units', 'centimeters', 'Position', [0 0 pageW pageH], ...
    'Color', 'w', 'PaperUnits', 'centimeters', 'PaperSize', [pageW pageH], 'InvertHardcopy', 'off');
cleanup = onCleanup(@() close(fig));
if isfile(file), delete(file); end
pageNo = 0;
ax = [];
y = 0;
newPage();

title = field(R, 'title', 'ImageLab Experiment Report');
addText(title, 17, 'bold', navy, 'Helvetica');
y = y + 0.15;
rule(navy);
meta = {'Students', field(R, 'students', ''); 'Roll numbers', field(R, 'rollNumbers', ''); ...
        'Experiment', num2str(field(R, 'experimentNumber', '')); ...
        'Date', char(datetime('now', 'Format', 'dd MMMM yyyy')); ...
        'Software', sprintf('MATLAB %s (base MATLAB implementations)', version('-release'))};
for k = 1:size(meta, 1)
    if ~isempty(meta{k, 2}), addPair(meta{k, 1}, meta{k, 2}); end
end

section('Aim', field(R, 'aim', ''));
section('Theory', field(R, 'theory', ''));
alg = field(R, 'algorithm', {});
if ischar(alg), alg = {alg}; end
if ~isempty(alg)
    heading('Algorithm');
    for k = 1:numel(alg), addText(sprintf('%d.  %s', k, char(alg{k})), 10, 'normal', ink, 'Helvetica', 0.5); end
end
code = field(R, 'code', '');
if ~isempty(code)
    heading('MATLAB Code');
    addCode(code);
end
section('Parameters', field(R, 'parameters', ''));

K = field(R, 'kernel', []);
if ~isempty(K) && isnumeric(K)
    heading('Kernel');
    for i = 1:size(K, 1)
        addText(strjoin(arrayfun(@(v) sprintf('%8s', num(v)), K(i, :), 'UniformOutput', false), ' '), ...
            10, 'normal', ink, 'Courier New');
    end
end

imgs = field(R, 'images', []);
if ~isempty(imgs)
    heading('Input and Output', firstRowHeight(imgs) + 1.6);
    addImages(imgs);
end

mets = field(R, 'metrics', []);
if ~isempty(mets)
    heading('Metrics');
    for k = 1:numel(mets), addPair(char(mets(k).name), num(mets(k).value)); end
end
obs = field(R, 'observations', {});
if ischar(obs), obs = {obs}; end
if ~isempty(obs)
    heading('Observations');
    for k = 1:numel(obs), addText(['•  ' char(obs{k})], 10, 'normal', ink, 'Helvetica', 0.5); end
end
section('Result', field(R, 'result', ''));
section('Conclusion', field(R, 'conclusion', ''));
q = field(R, 'quizScore', '');
if ~isempty(q), section('Quiz Score', num2str(q)); end
flushPage();

    % ------------------------------------------------------------- layout
    function newPage()
        clf(fig);
        pageNo = pageNo + 1;
        ax = axes(fig, 'Units', 'centimeters', 'Position', [0 0 pageW pageH], ...
            'XLim', [0 pageW], 'YLim', [0 pageH], 'YDir', 'reverse', 'Visible', 'off');
        hold(ax, 'on');
        % A full-page white rectangle keeps exportgraphics from cropping the page
        patch(ax, [0 pageW pageW 0], [0 0 pageH pageH], 'w', 'EdgeColor', 'none');
        text(ax, pageW - margin, pageH - 0.9, sprintf('ImageLab report · page %d', pageNo), ...
            'FontSize', 7.5, 'Color', grey, 'HorizontalAlignment', 'right', 'Interpreter', 'none');
        y = margin;
    end

    function flushPage()
        drawnow;
        exportgraphics(fig, file, 'ContentType', 'vector', 'Append', pageNo > 1, 'BackgroundColor', 'white');
    end

    function ensure(h)
        if y + h > pageH - margin - 0.6
            flushPage();
            newPage();
        end
    end

    function heading(t, need)
        % need = room for the heading plus the start of its content, so a
        % heading is never left alone at the bottom of a page
        if nargin < 2, need = 1.4; end
        y = y + 0.35;
        ensure(need);
        addText(t, 12.5, 'bold', navy, 'Helvetica');
        y = y + 0.05;
    end

    function section(t, body)
        if isempty(body), return; end
        heading(t);
        addText(char(body), 10, 'normal', ink, 'Helvetica');
    end

    function rule(color)
        plot(ax, [margin pageW - margin], [y y], '-', 'Color', color, 'LineWidth', 1.5);
        y = y + 0.35;
    end

    function addText(str, size, weight, color, font, indent)
        if nargin < 6, indent = 0; end
        charW = size * 0.0353 * 0.52;                     % average glyph width in cm
        perLine = max(10, floor((textW - indent) / charW));
        lines = wrapText(str, perLine);
        lineH = size * 0.0353 * 1.45;
        for n = 1:numel(lines)
            ensure(lineH);
            text(ax, margin + indent, y, lines{n}, 'FontSize', size, 'FontWeight', weight, ...
                'Color', color, 'FontName', font, 'VerticalAlignment', 'top', 'Interpreter', 'none');
            y = y + lineH;
        end
        y = y + 0.12;
    end

    function addPair(label, value)
        lines = wrapText(char(value), 70);
        lineH = 10 * 0.0353 * 1.45;
        for n = 1:numel(lines)
            ensure(lineH);
            if n == 1
                text(ax, margin, y, label, 'FontSize', 10, 'FontWeight', 'bold', 'Color', grey, ...
                    'VerticalAlignment', 'top', 'Interpreter', 'none');
            end
            text(ax, margin + 4.2, y, lines{n}, 'FontSize', 10, 'Color', ink, ...
                'VerticalAlignment', 'top', 'Interpreter', 'none');
            y = y + lineH;
        end
    end

    function addCode(str)
        lineH = 8.5 * 0.0353 * 1.35;
        lines = {};
        raw = splitlines(char(str));
        for n = 1:numel(raw)
            l = strrep(raw{n}, sprintf('\t'), '    ');
            if isempty(l), lines{end+1} = ''; end %#ok<AGROW>
            while ~isempty(l)
                lines{end+1} = l(1:min(96, end)); %#ok<AGROW>
                l = l(min(96, end)+1:end);
            end
        end
        for n = 1:numel(lines)
            ensure(lineH);
            rectangle(ax, 'Position', [margin - 0.15, y - 0.03, textW + 0.3, lineH + 0.02], ...
                'FaceColor', [0.955 0.965 0.98], 'EdgeColor', 'none');
            text(ax, margin, y, lines{n}, 'FontSize', 8.5, 'FontName', 'Courier New', 'Color', ink, ...
                'VerticalAlignment', 'top', 'Interpreter', 'none');
            y = y + lineH;
        end
        y = y + 0.2;
    end

    function h = firstRowHeight(imgs)
        h = 6;
        try
            info = imfinfo(ilab_store('path', imgs(1).id));
            h = min(((textW - 0.6) / 2) * info.Height / info.Width, 9);
        catch
            % image no longer available - use the default estimate
        end
    end

    function addImages(imgs)
        gap = 0.6;
        w = (textW - gap) / 2;
        col = 0;
        rowH = 0;
        for n = 1:numel(imgs)
            try
                I = imread(ilab_store('path', imgs(n).id));
            catch
                continue                                   % image no longer available
            end
            h = min(w * size(I, 1) / size(I, 2), 9);
            if col == 0, ensure(h + 0.8); rowH = 0; end
            x = margin + col * (w + gap);
            iw = h * size(I, 2) / size(I, 1);
            a = axes(fig, 'Units', 'centimeters', 'Position', [x + (w - iw) / 2, pageH - y - h, iw, h]);
            if size(I, 3) == 1, I = repmat(I, 1, 1, 3); end
            image(a, I);
            axis(a, 'image', 'off');
            text(ax, x + w / 2, y + h + 0.1, char(imgs(n).label), 'FontSize', 9, 'Color', grey, ...
                'HorizontalAlignment', 'center', 'VerticalAlignment', 'top', 'Interpreter', 'none');
            rowH = max(rowH, h + 0.7);
            col = col + 1;
            if col == 2
                col = 0;
                y = y + rowH;
            end
        end
        if col == 1, y = y + rowH; end
    end
end

% -------------------------------------------------------------------------
function lines = wrapText(str, perLine)
lines = {};
paragraphs = splitlines(char(str));
for p = 1:numel(paragraphs)
    words = strsplit(strtrim(paragraphs{p}), ' ');
    line = '';
    for k = 1:numel(words)
        w = words{k};
        while numel(w) > perLine                         % very long word: hard break
            if ~isempty(line), lines{end+1} = line; line = ''; end %#ok<AGROW>
            lines{end+1} = w(1:perLine); %#ok<AGROW>
            w = w(perLine+1:end);
        end
        if isempty(line)
            line = w;
        elseif numel(line) + 1 + numel(w) <= perLine
            line = [line ' ' w]; %#ok<AGROW>
        else
            lines{end+1} = line; %#ok<AGROW>
            line = w;
        end
    end
    lines{end+1} = line; %#ok<AGROW>
end
end

function v = field(s, name, default)
if isstruct(s) && isfield(s, name) && ~isempty(s.(name)), v = s.(name); else, v = default; end
end

function s = num(v)
if ischar(v) || isstring(v), s = char(v); return; end
if isempty(v), s = '-'; return; end
if ~isfinite(v), s = 'Inf';
elseif v == round(v), s = sprintf('%d', v);
else, s = sprintf('%.4g', v);
end
end
