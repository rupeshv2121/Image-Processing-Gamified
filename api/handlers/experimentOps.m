function data = experimentOps(op, p)
%EXPERIMENTOPS The 13 experiments and the report generator.
%   data = experimentOps(op, p) - called by ilab_dispatch for:
%   experimentCatalog   aim, theory, MATLAB code ... of every experiment
%   runExperiment       p.number, p.id (optional; default = the experiment's image)
%   report              HTML / PDF (/ DOCX) report from the experiment results

switch op
    case 'experimentCatalog'
        data = ilab_list(experimentCatalog());

    case 'runExperiment'
        n = ilab_param(p, 'number', 1);
        if ~isempty(ilab_param(p, 'id', ''))
            I = ilab_img(p);
        else
            E = experimentCatalog();
            I = ilab_limitSize(toDouble(imread(sampleImages('path', E([E.number] == n).defaultImage))));
        end
        R = runExperiment(n, I);
        data = struct('number', R.number, 'images', {ilab_list(R.images)}, 'metrics', {ilab_list(R.metrics)}, ...
            'observations', {R.observations}, 'kernel', ilab_matOrEmpty(R.kernel), 'parameters', R.parameters);

    case 'report'
        R = p;
        if isfield(R, 'images') && iscell(R.images), R.images = [R.images{:}]; end
        if isfield(R, 'metrics') && iscell(R.metrics), R.metrics = [R.metrics{:}]; end
        if isfield(R, 'kernel') && isstruct(R.kernel), R.kernel = []; end
        info = generateReport(R);
        data = struct('name', info.name, 'docx', info.docx, 'pdf', info.pdf);

    otherwise
        error('ImageLab:unknownOperation', 'Unknown operation "%s".', op);
end
end
