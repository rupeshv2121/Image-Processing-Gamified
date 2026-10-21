function id = ilab_put(I, tag)
%ILAB_PUT Save a result image to the store and return its new id.
id = ilab_store('save', I, tag);
end
