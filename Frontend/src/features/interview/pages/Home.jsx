import React from "react";
import "../style/home.scss"  

const Home = () => {
    return (
        <main className="home">
            <div className="left">
                <textarea name="job_description" id="job_description" placeholder="Enter Job Description"></textarea>
            </div>
            <div className="right">
                <div className="input-group">
                    <label htmlFor="resume">Upload Resume</label>
                    <input type="file" name="resume" id="resume" accept=".pdf"/>                    
                </div>
                <div className="input-group">
                    <label htmlFor="self_description">Self Description</label>
                    <textarea name="self_description" id="self_description" placeholder="Enter Self Description"></textarea>
                </div>
                    <button className='generate-btn'>Generate Questions</button>
            </div>
        </main>
    );
};

export default Home;