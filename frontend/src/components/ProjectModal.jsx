import { useState } from "react";
import Modal from "./Modal.jsx";
import { useDialog } from "../contexts/DialogContext.js";
import { createProject } from "../services/projectService.js";

export default function ProjectModal({ isOpen, onClose, onCreated }) {
  const { showAlert } = useDialog();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleClose = () => {
    setTitle("");
    setDescription("");
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const project = await createProject(title, description);
      handleClose();
      await onCreated(project);
    } catch (error) {
      console.error("Erreur soumission modal:", error);
      await showAlert("An error occurred. Please try again.");
    }
  };

  return (
    <Modal isOpen={isOpen} title="New Project" onClose={handleClose}>
      <form id="project-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="projectTitle">Title</label>
          <input
            type="text"
            id="projectTitle"
            name="title"
            placeholder="My project..."
            required
            autoComplete="off"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="form-group" id="project-description-group">
          <label htmlFor="projectDescription">Description</label>
          <textarea
            id="projectDescription"
            name="description"
            rows="3"
            placeholder="Optional description..."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="dn-dialog-btn dn-dialog-btn--cancel"
            data-action="cancel"
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            id="project-form-submit"
            className="dn-dialog-btn dn-dialog-btn--primary"
          >
            Create
          </button>
        </div>
      </form>
    </Modal>
  );
}
