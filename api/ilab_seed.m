function ilab_seed(p)
%ILAB_SEED Seed the random generator from p.seed (reproducible), else shuffle.
if isfield(p, 'seed') && ~isempty(p.seed), rng(p.seed); else, rng('shuffle'); end
end
