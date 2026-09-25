
import React from "react";
import "../auth.form.scss";
import {useNavigate, Link} from "react-router"


// react page for login
const Login = () => {

    const navigate = useNavigate();
    
    const handleSubmit = (e) => {
        e.preventDefault()
    }

    return (
        <main>
            <div className="form-container">
                <h1>Login</h1>
                
                <form onSubmit={handleSubmit}>

                    <div className="input-group">
                        <label htmlFor="email">Email</label>
                        <input type="email" id="email" name="email" placeholder="Enter your email" />
                    </div>
                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input type="password" id="password" name="password" placeholder="Enter your password" />
                    </div>
                    <button type="submit" className="button primary-button">Login</button>
                </form>

                <p>Don't have an account? <Link to="/register">Register</Link></p>
            </div>
        </main>
    );
};

export default Login;